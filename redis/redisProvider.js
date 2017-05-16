/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var redis = require("ioredis");
var s2 = require("nodes2ts");
var _ = require("underscore");
var common = require("../commonUtil");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;

var provider = (function() {

    var driver_cells,
        CITY_CELLS = "city_cells";
    var gridArray = null;
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

    //----------------------------------------methods to add driver position--------------------------------------------
    provider.isMemberOfCityCells = function(item){
        var promise = new Promise(function(resolve,reject){
            client.sismember(CITY_CELLS,item).then(function(results) {
                if (results) {
                    resolve(item);
                } else {
                    reject(item);
                }
            });
        });
        return promise;
    }

    provider.getCellforVehicleKey = function(vehicleKey,vehicle_id,cb){
        var cellArray = s2common.getParentIdArray(vehicleKey,12,3);
        for(var i = 0; i < cellArray.length; i++){
            var item = cellArray[i].pos();
            provider.isMemberOfCityCells(item).then(function(cell){
                logger.log("loop, index = " + i + "cell="+cell);
                if(cell)
                    cb(cell);
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
            client.sadd("city_cells:" + grid_cell, leaf_id).then(function(results){
                logger.log("adding key = " + leaf_id + "-to grid|"+grid_cell+ " = results: "+results);
            });
        });
    }

    provider.addVehiclePosition = function(driverKey,vehicle_id,timestamp){
        //zadd vehicle:001 1493758483 2203795001640038161
        //zrange vehicle:004459 0 -1 withscores
        var key = "vehicle:"+vehicle_id;
        provider.getCellforVehicleKey(driverKey,vehicle_id,function(grid_cell){

            client.sadd("city_cells:" + grid_cell, driverKey);
            client.zadd(key,timestamp,driverKey).then(function(results){
                logger.log("adding vehicle to key = "+ key + ", results ="+results);
            })
        });
        var cell = null;
    }
    //----------------------------------------end of methods to add driver position-------------------------------------
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
        //driver_cells
        var key = "city_cells:2203795067297071104";
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
            });
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

    /***
     *
     */
    provider.addDriverSet = function(){

        //getS2CellIdAtLevel("2203794985692692496",12);
        console.log("adding sets...");
        var hash_table = {
            cell_id:"2203795067297071104",
            vehicle:"zdw065gp",
            timestamp:"1492783299"
        };

        client.hmset("vehicle:12345",hash_table,function(result){
            console.log("hashset --- " + result);
        });
        client.hmset("vehicle:2203795003930470261","cell_id","2203795067297071104","vehicle","zdw065gp",
            "timestamp","1492783261",function(result){
                console.log("hash multi-set = " + result);
            });

        client.hgetall("vehicle:2203795003930470261",function(error,data){
            var array = _.toArray(data);
            array.forEach(function(item){
                console.log(item);
            });
            console.log("hgetting all hashes ["+ array[2] +"]-"+JSON.stringify(data));
        });
    };

    return provider;
})();
exports.provider = provider;

//2203795067297071104
//2203793418029629440
/*provider.getDriversInCell("2203793418029629440",function(data){
 logger.log("driver locations in cell = " + data);
 });*/

/*provider.getCellforVehicleKey("2203795001640038161","004455",function(cell){
 logger.log("get cell id for vehicle  = " + cell);
 });*/

//provider.addDriverPosition("2203795003930470261");

var tt = new Date().getTime();
logger.log("timeInMillis = " + tt);
provider.addVehiclePosition("2203795122495293251","004459",tt);
