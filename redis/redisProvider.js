/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var redis = require("ioredis");
var s2 = require("nodes2ts");
var _ = require("underscore");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;

var provider = (function() {

    var TRIP_KEY        = "trip:",
        CITY_CELLS      = "city_cells",
        CELL_KEY        = "cell:",
        VEHICLE_KEY     = "vehicle:";

    //var gridArray = null;
    var client = new redis({
        retryStrategy: function (times) {
            var delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    /**
     * Create a redis service instance to localhost. Will
     * change to connect to correct environment
     */
    function provider(){
        client.on('error',function(err,data){
            if(err.message.startsWith("connect ECONNREFUSED")){
                console.log("server connection failed...");
            };
        });

        client.on("connect",function(){
            console.log("redis server connection succeeded...");
        });
    }


    /**
     *  method to add drivers to grid cells by grid_id
     *  Retrieve the s2 cell that this driver GPS location belongs to (isMemberOfGrid)
     * @param leaf_id
     */
    function S2ArrayToString(array){
        var v = " =[";
        array.forEach(function(item){
            v +=item.id +" = "+item.level()+"|";
        });
        return v+"]";
    }

    //----------methods to add driver position--------------------------
    provider.isMemberOfCityCells = function(item){
        var promise = new Promise(function(resolve,reject){
            client.sismember(CITY_CELLS,item).then(function(results) {
                if (results === 1) {
                    resolve(item);
                } else if(results === 0){
                    resolve(0)
                    //reject(item);
                }
            }).catch(function(error){
                logger.log('error = '+error);
            });
        });
        return promise;
    }

    provider.getCellforVehicleKey = function(vehicleKey,vehicle_id,cb){
        var cellArray = s2common.getParentIdArray(vehicleKey,12,3);
        for(var i = 0; i < cellArray.length; i++){
            var item = cellArray[i].pos();
            provider.isMemberOfCityCells(item).then(function(cell){
                if(cell > 0){
                    logger.log("loop, index = " + i + "cell="+cell);
                    cb(cell);
                }
            }).catch(function(error){
                logger.log("not a member = " + error);
            });
        }
    }

    /**
     * get leaf S2's parent at level 12-14. Then check if each of the leaf's parent
     * IDs are members of city_cells redis key (i.e. valid grid cells). if so, add
     * the driver's position key to the grid cell.
     * @param leaf_id
     */
    provider.addDriverPosition = function (leaf_id,vehicle_id) {
        provider.getCellforVehicleKey(leaf_id,vehicle_id,function(grid_cell){
            if(grid_cell === 0) return;
            client.sadd("city_cells:" + grid_cell, leaf_id).then(function(results){
                logger.log("adding key = " + leaf_id + "-to grid|"+grid_cell+ " = results: "+results);
            }).catch(function(error){
                logger.log('error = '+error);
            });;
        });
    }

    provider.getVehiclePositionByTime = function(vehicle_id,secondsAgo,cb){
        var now = new Date().getTime();
        var before = now - secondsAgo * 1000;
        var minutesAgo = ((secondsAgo * 1000)/60000).toFixed(0);
        logger.log("minutes to go back from NOW --- " +minutesAgo+ "min");
        client.zrangebyscore(VEHICLE_KEY+vehicle_id,before,now,'withscores').then(function(results){
                logger.log("----rangebyscore >>> " +before + ">"+ results.length);
                //logger.log(results);
                cb(results);
        }).catch(function(error){
            logger.log('error = '+error);
        });;
    }

    provider.getVehiclePosition = function(vehicle_id,cb){
            client.zrange(VEHICLE_KEY+vehicle_id,0,-1).then(function(results){
                cb(results);
            }).catch(function(error){
                logger.log('error = '+error);
            });
    }

    provider.getVehiclePositionByRange = function(vehicle,index_start,index_end,cb){
            client.zrange(VEHICLE_KEY+vehicle,index_start,index_end,'withscores').then(function(results){
                logger.log(results);
                cb(results);
            }).catch(function(error){
                logger.log('error = '+error);
            });;
    }

    provider.getVehiclePositionAndScore = function(vehicle_id,cb){
            client.zrange(VEHICLE_KEY+vehicle_id,0,-1,'withscores').then(function(results){
                logger.log(results);
                cb(results);
        }).catch(function(error){
                logger.log('error = '+error);
            });;
    }

    /**
     * This method uses redis transactions to ensure driver_key is added to CELL_KEY
     * and VEHICLE_KEY as an atomic transaction.
     * @param driverKey
     * @param vehicle_id
     * @param timestamp
     */
    provider.addVehiclePosition = function(driverKey,vehicle_id,timestamp){
        //zadd vehicle:001 1493758483 2203795001640038161
        //zrange vehicle:004459 0 -1 withscores
        var key = VEHICLE_KEY + vehicle_id;
        provider.getCellforVehicleKey(driverKey,vehicle_id,function(grid_cell){
            logger.log("did we get cell for vehiclekey? = " + grid_cell);
            if(grid_cell > 0) {
                client.multi()
                    .sadd(CELL_KEY + grid_cell, driverKey+"-"+vehicle_id)
                    .zadd(key, timestamp, driverKey)
                    .exec().then(function (results) {
                    logger.log("adding vehicle to key = " + key + ", results =" + results);

                }).catch(function(error){
                    logger.log('error = '+error);
                });;
            }
        });
    }

    /**
     * Create unique parent cell id each time a driver is created under
     * driver_cell set. No duplicate cell ids
     * @param cell_id
     */
    provider.createCellPosition = function(cell_id){
        var s2cell = new s2.S2CellId(cell_id);
        if(s2cell.level() < 19){
            client.sadd(CITY_CELLS,cell_id);
        }
    }

    /**
     * getCityGrid returns a list of all S2 cells at level 12-14 that makes up
     * city boundary under default constraints (min=12, max = 14, max_cells = 1000)
     * currently retrieves around 960 cells between level 12-14 when given a centre point
     * with a radius (meters) configured in config/init.js as {radius: '32000'}
     * @returns {*}
     */
    provider.getCityGrid = function(cb){
        client.smembers("city_cells").then(function(results){
            cb(results);
        });
    }

    /**
     * REDO----
     * retrieve parent_ids from the driver_cell set
     * @param driver_id
     */
    provider.getDriverPositions = function(driver_key,cb){
        //driver_cells - do we retrieve vehicle_ids in cell and then filter?
        var key = "cell:2203795067297071104";
        logger.log(key);
        client.smembers(key).then(function(celldata){
            logger.log("driver at level = " + ", retrieved in cell="+celldata[0]);
            cb(celldata);
        });
    }

    /**
     * Retrieve all drivers that are in a given cell
     * @param s2cell_id
     */
    provider.getDriversInCell = function(s2cell_id,cb){
        if(new s2.S2CellId(s2cell_id).isLeaf()){
            cb(null);
        }
        else {
            client.smembers("city_cells:" + s2cell_id).then(function (results) {
                //logger.log(results);
                if (results.length > 0) {
                    var array = _.toArray(results);
                    cb(array)
                }
                else {
                    logger.log("no members " + results);
                    cb(null);
                }
            }).catch(function(error){
                logger.log('error = '+error);
            });;
        }
    }

    provider.getCellIdsInCellArray = function(cellId_array){
        //check the level of s2cell grid_ids and make sure they are between 12 - 14
        //if so, query redis for cells that meet criteria
        var array = new Array();
        cellId_array.forEach(function(each_cell){
            var cellIds = getCellIdsInCell(each_cell);
            arra.push(cellIds);
        });
        return array;
    }

    /**
     * retrieve keys from driver hashset
     * @type {Array}
     */
    provider.keys = function(cb){
        client.keys(driver_hashset, function (err, data) {
            console.log("logging keys ->" + data);
            cb(data);
        });
    }

    return provider;
})();
exports.provider = provider;

//2203795067297071104
//2203793418029629440
/*provider.getDriversInCell("2203793418029629440",function(data){
 logger.log("driver locations in cell = " + data);
 });*/

provider.getCellforVehicleKey("2203795001640038161","004455",function(cell){
 logger.log("-get cell id for vehicle  = " + cell);
 });

//provider.addDriverPosition("2203795003930470261");

var ts = new Date().getTime();
try{
    var vehiclekey = "2203795008470789907";
    var vehicle2   = "2203795008470789908";
    var vehicle3   = "2203795008470789909";
    var vehicle4   = "2203795008470789903";

    var vehicleId = "004458";

    provider.addVehiclePosition(vehiclekey,"004458",ts);
    provider.addVehiclePosition(vehicle2,"004459",ts+80);
    provider.addVehiclePosition(vehicle3,"004460",ts+120);
    provider.addVehiclePosition(vehicle4,"004461",ts+150);

    //14900 - 9800 (at 9:02 pm)
    provider.getVehiclePositionByTime(vehicleId,14900,function(results){
        logger.log(results);
    });

    provider.getVehiclePosition(vehicleId,function(results){
        logger.log(">>> positions for vehicle_id = " + vehicleId + " [total pos = "+results.length);
        results.forEach(function(item){
            logger.log("vehicle_id:" + vehicleId + " - [" + item +"]");
        });
    });
    logger.log("adding to cell id = -------" + vehiclekey +
        "=["+s2common.getParentIdAtLevel(12,vehiclekey)+"]------");

}catch(error){
    logger.log(error);
}

