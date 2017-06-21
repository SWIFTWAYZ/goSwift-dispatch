/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var _ = require("lodash");
var redis = require("ioredis");
var s2 = require("nodes2ts");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;

var total_millis = 0;

var provider = (function () {

    var TRIP_KEY = "trip:",
        CITY_CELLS = "city_cells",
        CELL_KEY = "cell:",
        VEHICLE_KEY = "vehicle:",
        CURR_VEHICLE_CELL = "vcell:";

    var client = new redis({
        retryStrategy: function (times) {
            var delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    client.monitor(function (err, monitor) {
        // Entering monitoring mode.
        monitor.on('monitor', function (time, args, source, database) {
            //logger.debug(time + ": " + args);
            console.log(args);
        });
    });
    /**
     * Create a redis service instance to localhost. Will
     * change to connect to correct environment
     */
    function provider() {
        logger.log("CREATING REDIS PROVIDER()");
        client.on('error', function (err, data) {
            if (err.message.startsWith("connect ECONNREFUSED")) {
                console.log("server connection failed...");
            }
            ;
        });

        client.on("connect", function () {
            console.log("redis server connection succeeded...");
        });
    }


    /**
     *  method to add drivers to grid cells by grid_id
     *  Retrieve the s2 cell that this driver GPS location belongs to (isMemberOfGrid)
     * @param leaf_id
     */
    function S2ArrayToString(array) {
        var v = " =[";
        array.forEach(function (item) {
            v += item.id + " = " + item.level() + "|";
        });
        return v + "]";
    }

    //----------methods to add driver position--------------------------
    provider.isMemberOfGrid = function (item) {
        var promise = new Promise(function (resolve, reject) {
            client.sismember(CITY_CELLS, item).then(function (results) {
                //logger.log("ismember? item = "+ item + ",response = " + results);
                //resolve(item);
                if (results === 1) {
                    //if item is a member of cell, we return the key
                    resolve(item);
                } else if (results === 0) {
                    //else we return 0
                    resolve(0)
                    //reject(item);
                }
            }).catch(function (error) {
                logger.log('error = ' + error);
                reject(error);
            });
        });
        return promise;
    }

    provider.getVehicleGridCell2 = function (vehicleKey, vehicle_id, cb) {
        var cellArray = s2common.getParentIdArray(vehicleKey, 12, 3);
        var promises = [];
        //client.multi();
        cellArray.forEach(function (item) {
            //promises.push(client.sismember(CITY_CELLS,item.pos()));
            promises.push(provider.isMemberOfGrid(item.pos()))
            logger.log("forEach push promises for item = " + item.pos());
        });
    }

    provider.getVehicleGridCell_Level12 = function(vehicleKey,vehicle_id){
        var parent_id = s2common.getParentIdAtLevel(12,vehicleKey);
        return parent_id;
    }
    provider.getVehicleGridCell = function (vehicleKey, vehicle_id) {
        //do we return a promise here or use a callback??
        return new Promise(function (resolved, rejected) {
            var cellArray = s2common.getParentIdArray(vehicleKey, 12, 3);
            cellArray.forEach(function (item, index) {
                (new Promise(function (resolve, reject) {
                    resolve(item.pos())
                })).then(function (results) {
                    //is this test always necessesary
                    provider.isMemberOfGrid(results).then(function (cell) {
                        //logger.log("loop2, index = " + "cell=" + cell);
                        if (cell > 0) {
                            //logger.log("index = [" + index + "],vehicle=" + +vehicle_id + "-cell=" + cell);
                            //cb(cell);
                            resolved(cell);
                        } else {
                            resolved(null);
                        }
                    });
                });
            });
        });
    }

    provider.getVehiclePosWithScore = function (vehicle_id) {
        return client.zrange(VEHICLE_KEY + vehicle_id, 0, -1, 'withscores');
    }

    /**
     * Get vehicle positions by setting a start and end timestamp to narrow the search
     * @param vehicle
     * @param index_start
     * @param index_end
     * @returns {*}
     */
    provider.getVehiclePosByTimeRange = function (vehicle, index_start, index_end) {
        return client.zrange(VEHICLE_KEY + vehicle, index_start, index_end, 'withscores');
    }

    /**
     * Get vehicle positions from X seconds ago, note that the current implementation
     * stores timestamp in milliseconds and not seconds (new Date().getTime());
     * @param vehicle_id
     * @param secondsAgo
     */
    provider.getVehiclePosByTime = function (vehicle_id, secondsAgo) {
        return new Promise(function (resolve, reject) {
            var now = new Date().getTime();
            var before = now - secondsAgo * 1000;
            var minutesAgo = ((secondsAgo * 1000) / 60000).toFixed(0);
            logger.log("minutes to go back from NOW --- " + minutesAgo + "min");
            client.zrangebyscore(VEHICLE_KEY + vehicle_id, before, now, 'withscores').then(function (results) {
                logger.log("----rangebyscore >>> " + before + ">" + results.length);
                //cb(results);
                resolve(results);
            }).catch(function (error) {
                logger.log('error = ' + error);
                reject(error);
            });
            ;
        });
    }

    provider.getVehiclePosition = function (vehicle_id) {
        return client.zrange(VEHICLE_KEY + vehicle_id, 0, -1);
    }

    /**
     * Given an array of vehicles Ids, we retrieve vehicle location s2keys
     * stored in redis's vehicle:id key (e.g. vehicle:4524)
     * @param vehiclesArray
     * @param cb
     */

    var vehicleObj = function(vehicle_id,key,time,cell,gps_latlng,level){
        this.vehicle_id = vehicle_id;
        this.s2key = key;
        this.tstamp = time;
        this.cell = cell;
        this.latlng = gps_latlng;
        this.s2_level = level;
    }

    String.prototype.convertToLatLng = function(){
        var latlng =  new s2.S2CellId(this).toLatLng();
        return latlng.lngDegrees.toFixed(6)+","+latlng.latDegrees.toFixed(6);
    }
    String.prototype.getS2CellLevel = function(){
        return new s2.S2CellId(this).level();
    }
    /**
     * Pipeline to retrieve vehicle positions (s2keys) with timestamp given
     * an array of vehicle ids (->zrange vehicle:004467 0 -1 withscores)
     * @param vehiclesArray
     * @param cb
     */
    provider.getRedisVehiclePositions = function(vehiclesArray, cb){

        var p = client.pipeline()
        var p2;
        var start_time = new Date().getTime();
        //logger.log("vehicles in Array = "+ vehiclesArray.length + "->");
        if(vehiclesArray.length === 0){
            cb(null);
            return;
        }
        else {
            vehiclesArray.forEach(function (composite) { //item
                var item = composite.vehicle_id;
                //logger.log(item + "---" + composite.cell_id);
                p2 = p.zrange(VEHICLE_KEY + item, 0, -1, 'withscores')
            });
            p2.exec().then(function (vehicle_locations) {
                //--------------------------------------------
                var vehicleObjectArray = [];
                vehicle_locations.forEach(function (vehicle, index) {
                    if (vehicle !== null && vehicle.length > 0) {
                        //vehicle represents the array of s2 positions from vehicle_key
                        var s2_key = vehicle[1][0];
                        var latlng = s2_key.convertToLatLng();
                        var level = s2_key.getS2CellLevel();
                        var obj = new vehicleObj(vehiclesArray[index].vehicle_id, vehicle[1][0],
                            vehicle[1][1], vehiclesArray[index].cell_id,latlng,level);
                        vehicleObjectArray.push(obj);
                    }
                });

                //create an object that stores, vehicle_id, s2key_id,timestamp
                //logger.log("pipeline()->exec()->" + vehicle_locations.length + "-"+vehicle_locations[0]);
                var end_time = new Date().getTime();
                var interval = (end_time - start_time)/1000;
                total_millis+=interval;
                logger.log("getRedisVehiclePositions query duration = "+interval);
                cb(vehicleObjectArray);
                //----------------------------------------------
            });
        }
    }

    //re-look at this implemetation, what do we do when driver goes off-line?
    //when do we remove driver from cell?
    provider.removeVehicleCell = function (vehicle_id, timestamp, cellId) {
        return new Promise(function (resolve, reject) {
            var vehicle_cell_key = CURR_VEHICLE_CELL + vehicle_id;
            client.zrange(vehicle_cell_key, 0, -1).then(function (cell_vehicle) {
                //logger.log("ZRANGE --> vehicle_cell:" + cell_vehicle + ":"+cell_vehicle.length);
                if (cell_vehicle.length === 0) {
                    logger.log("skip = " + cell_vehicle + "->" + cellId);
                    client.zadd(vehicle_cell_key, timestamp, cellId)
                    resolve(cell_vehicle);
                    //return;
                }
                else {
                    logger.log("remove2 = " + cell_vehicle);
                    client.zrem(vehicle_cell_key, cell_vehicle).then(function (results) {
                        client.zadd(vehicle_cell_key, timestamp, cellId)
                        resolve(results);
                    });
                }
            });
        });
    }

    /**
     * get the current cell for a given vehicle_id
     * @param vehicle_id
     */
    provider.getCurrentCellByVehicleId = function(vehicle_id){
        return new Promise(function(resolve,reject){
            var key = CURR_VEHICLE_CELL+vehicle_id;
           client.zrange(key,0,-1).then(function(results){
               //logger.log("redis:getCurrentCellByVehicleIdfor vehicle_id : "+vehicle_id + "-results :"+results.length);
                resolve(results);
           })
        });
    }

    /**
     * This method uses redis transactions to ensure driver_key is added to CELL_KEY
     * and VEHICLE_KEY as an atomic transaction.
     * @param driverKey
     * @param vehicle_id
     * @param timestamp
     */
    provider.addVehiclePosition = function (driverKey, vehicle_id, timestamp) {
        return new Promise(function (resolve, reject) {

            var vehicle_key = VEHICLE_KEY + vehicle_id;
            var vehicle_cell_key = CURR_VEHICLE_CELL + vehicle_id;

            var grid_cell = s2common.getParentIdAtLevel(12,driverKey);
                var grid_key = CELL_KEY + grid_cell;
                if (grid_cell > 0) {
                    return client.multi()
                        .zadd(grid_key, timestamp, vehicle_id)
                        .zadd(vehicle_cell_key, timestamp, grid_cell)
                        //.zadd(vehicle_cell_key, grid_cell, vehicle_id)
                        .zadd(vehicle_key, timestamp, driverKey)
                        .exec()
                        .then(function (results) {
                            logger.log("add " + vehicle_key + "/key=" + driverKey + "/cell=" + grid_cell +
                                ", results =" + results);
                            //resolve(results);
                        }).catch(function (error) {
                        logger.log("Error with addVehiclePosition: " + error);
                        reject(error);
                    });
                }
            }).catch(function (lastError) {
                logger.log("lastError:" + lastError);
            });
        //});
    }

    /**
     * This method used vehicle_id to retrieve 1st cell (s2cell[0]) and
     * work out the parent cell (level 12 - 14) of such a cell_key
     * Do we need this method if we have VEHICLE_CELL key?
     * @param vehicle_id
     */
    provider.getVehicleCell = function (vehicle_id) {
        return new Promise(function (resolved, rejected) {
            client.zrange(VEHICLE_KEY + vehicle_id, 0, -1).then(function (s2cell_id) {
                var vehicleKey = s2cell_id[0];
                logger.log("vehicle id =" + vehicle_id + "....count = " + s2cell_id.length);
                if (vehicleKey === undefined || s2cell_id.length == 0) {
                    resolved(null);
                    return;
                }
                logger.log("current cell positions = [" + s2cell_id.length + "] -" + vehicleKey);
                var array = s2common.getParentIdArray(vehicleKey, 12, 3);

                array.forEach(function (item) {
                    (new Promise(function (resolve, reject) {
                        resolve(item.pos());
                    })).then(function (results) {
                        client.sismember(CITY_CELLS, results).then(function (data) {
                            logger.log("promise resolved? = " + data + "-cellid=" + results);
                            if (data) {
                                resolved(item.pos())
                            }
                        });
                    }).catch(function (error) {
                        rejected(error);
                    });
                });
            });
        });
    }

    /**
     * Retrieves all vehicles contained in the given cell array
     * -> zrange vehicle:004467 0 -1 withscores
     * @param cell_array
     * @returns {*}
     */
    provider.getVehiclesInCellArray = function(cell_array){
        return new Promise(function(resolve,reject){
            var p2;
            var p = client.pipeline()
            //logger.log("cell array = "+ cell_array);
            if(cell_array.length === 0) {
                reject(null);
                return;
            }
            cell_array.forEach(function(s2cell_id){
                //logger.log("ZRANGE --->" + CELL_KEY+s2cell_id);
                p2 = p.zrange(CELL_KEY+s2cell_id,0,-1,'withscores')
            });
            p2.exec().then(function(results){
                resolve(results);
            }).catch(function(error){
                logger.log("getVehiclesInCellArray:"+ error);
                reject("getVehiclesInCellArray:"+ error);
            })
        })
    }

    /**
     * change cell position of vehicle using atomic transaction to remove and add to cell
     * @param fromCellkey
     * @param toCellkey
     * @param vehicle_id
     * @param timestamp
     */
    provider.changeCellPosition = function (fromCellkey,toCellkey, vehicle_id, timestamp) {
        //first remove vehicle from cell the driver is exiting
        //then add vehicle to cell its entering. Use redis transactions for this
        return new Promise(function (resolve, reject) {
            logger.log("vehicle_id = " + vehicle_id + " exists >"+fromCellkey + "/ and enters grid = " + toCellkey);
            //logger.log("got cell for vehiclekey? = " + fromCellkey + "=vehicle_id :" + vehicle_id + "}");
                return client.pipeline()
                    .zrem(CELL_KEY + fromCellkey, vehicle_id)
                    .zadd(CELL_KEY + toCellkey, timestamp, vehicle_id)
                    .zrem(CURR_VEHICLE_CELL+vehicle_id,fromCellkey)
                    .zadd(CURR_VEHICLE_CELL+vehicle_id,timestamp,toCellkey)
                    .exec()
                    /*.then(function (results) {
                    //cb(results);
                    //resolve(results);*/
                }).catch(function(error){
                    logger.log("Error changeCellPosition:"+error.stack);
                    reject("Error changeCellPosition:"+error);
                });
        //});

    }

    /**
     * When vehicle exits a cell, we remove/delete vehicle_id from CELL_KEY
     * @param driverKey
     * @param vehicle_id
     * @param timestamp
     */
    provider.leaveCityCell = function (driverKey, vehicle_id, cb) {
        provider.getVehicleGridCell(driverKey, vehicle_id, function (grid_cell) {
            client.zrem(CELL_KEY + grid_cell, vehicle_id).then(function (results) {
                cb(results);
            });
        });
    }
    /**
     * Create unique parent cell id each time a driver is created under
     * driver_cell set. No duplicate cell ids
     * @param cell_id
     */
    provider.createCellPosition = function (cell_id) {
        var s2cell = new s2.S2CellId(cell_id);
        if (s2cell.level() < 19) {
            client.sadd(CITY_CELLS, cell_id);
        }
    }

    /**
     * getCityGrid returns a list of all S2 cells at level 12-14 that makes up
     * city boundary under default constraints (min=12, max = 14, max_cells = 1000)
     * currently retrieves around 960 cells between level 12-14 when given a centre point
     * with a radius (meters) configured in config/init.js as {radius: '32000'}
     * @returns {*}
     */
    provider.getCityGrid = function () {
        return client.smembers(CITY_CELLS);
    }

    /**
     * REDO----
     * retrieve parent_ids from the driver_cell set
     * @param driver_id
     */
    provider.getDriverPositions = function (driver_key) {
        //driver_cells - we retrieve driver quadKeys from VEHICLE_KEY
        return new Promise(function (resolve, reject) {
            client.zrange(VEHICLE_KEY + driver_key, 0, -1, 'withscores').then(function (celldata) {
                //cb(celldata);
                resolve(celldata);
            }).catch(function (error) {
                var err_msg = "error retrieving position for driver id = ";
                //cb(err_msg + driver_key);
                reject(err_msg + driver_key);
            });
        });
    }

    /**
     * Retrieve all drivers that are in a given cell
     * @param s2cell_id
     */
    provider.getDriversInCell = function (s2cell_id) {
        return new Promise(function (resolve, reject) {
            if (new s2.S2CellId(s2cell_id).isLeaf()) {
                //cb(null);
                resolve(null);
            }
            else {
                client.zrange(CELL_KEY + s2cell_id, 0, -1, 'withscores').then(function (results) {
                    if (results.length > 0) {
                        var array = _.toArray(results);
                        resolve(array);
                    }
                    else {
                        logger.log("no members " + results);
                        resolve(null);
                    }
                }).catch(function (error) {
                    logger.log('error = ' + error);
                    reject(error);
                });
            }
        });
    }

    /**
     * retrieve keys from driver hashset
     * @type {Array}
     */
    provider.keys = function (cb) {
        client.keys(driver_hashset, function (err, data) {
            console.log("logging keys ->" + data);
            cb(data);
        });
    }

    return provider;

}).call(this);
exports.provider = provider;

//provider.changeCellPosition("2203794242663350272","2203682917111037952","4524",new Date().getTime());

/*provider.getCurrentCellByVehicleId("4524").then(function(data){
    logger.log("results ----> "+ data);
});
*/
/*
var cellArray = ["2203792181079048192",
        "2203795067297071104",
        "2203794654980210688",
        "2203794517541257216",
        "2203794380102303744",
        "2203794242663350272"];

provider.getVehiclesInCellArray(cellArray).then(function(data){
    logger.log("pipeline request results = "+ data.length);
    data.forEach(function(item,index){
        logger.log(item);
    })
})*/

/*s2common.getDriversFromFile2(function(data){
 logger.log("size of data = " + data.length);
 var time = new Date().getTime();
 data.forEach(function(item){
 //logger.log("item = "+ item);
 provider.addVehiclePosition(item,"004467",time).then(function(results){
 logger.log(results);
 })
 })
 });*/

//add new method to geocode each cell and store in a new data structure
//that holds both the cell_id, the centroid gps and the name of suburb
// (e.g. 2203795067297071104, "-26.139121769,28.045368762", "Woodmead - Austin street"

//add method which given a rider location, can retrieve all vehicles in ascending
//order that are closest to the rider using a s2circlecoverer.

//2203795067297071104
//2203793418029629440

/*
 var vehicle_id59 = "004468";

 provider.getDriverPositions(vehicle_id59).then(function(celldata){
 logger.log("driver = " + vehicle_id59 + ", positions = " + celldata);//JSON.stringify(celldata));
 })

 provider.getDriversInCell("2203688414669176832").then(function(data){
 logger.log("drivers in cell = "+data);
 });
 */

/*var ts = new Date().getTime();
 provider.changeCellPosition("2203840188725229341",vehicle_id59,ts).then(function(results){
 logger.log(results);
 });

 provider.getVehicleCell(vehicle_id59).then(function(results){
 logger.log("current pos = " + results);
 });*/

/*
 provider.getVehicleGridCell("2203795001640038161","004469").then(function(cell){
 logger.log("-get cell id for vehicle  = " + cell);
 });
 */
/*var vehicle_id59 = "004460";
 provider.leaveCityCell("2203795001640038161",vehicle_id59,function(response){
 logger.log("removing vehicle id = " + vehicle_id59 + "-"+response);
 })*/

//provider.addDriverPosition("2203795003930470261");

/*--
 var ts = new Date().getTime();
 try{
 var vehiclekey = "2203840532358176487";
 var vehicle2   = "2203803946975095603";
 var vehicle3   = "2203792415811550533";
 var vehicle4   = "2203806913340145105";

 var vehicleId = "004458";

 provider.addVehiclePosition(vehiclekey,"004473",ts);
 provider.addVehiclePosition(vehicle2,"004474",ts+80);
 provider.addVehiclePosition(vehicle3,"004475",ts+120);
 provider.addVehiclePosition(vehicle4,"004476",ts+150);

 provider.getVehicleCell("004473").then(function(results){
 logger.log("getVehicleCell" +"/"+ results);
 });
 /*provider.getVehiclePosition(vehicle2,function(results){
 logger.log(">>> positions for vehicle_id = " + vehicle2 + " [total pos = "+results.length);
 results.forEach(function(item){
 logger.log("vehicle_id:" + vehicle2 + " - [" + item +"]");
 });
 });
 logger.log("adding to cell id = -------" + vehicle2 +
 "=["+s2common.getParentIdAtLevel(12,vehicle2)+"]------");*/
/*--
 }catch(error){
 logger.log(error);
 }


 /*
 //14900 - 9800 (at 9:02 pm)
 provider.getVehiclePosByTime(vehicleId,14900,function(results){
 logger.log(results);
 });

 var driver_id2 = "004471";
 provider.getDriverPositions(driver_id2,function(results){
 logger.log("position of "+ driver_id2 + ", positions = " + results);
 })

 var grid_key = "2203795067297071104";
 var grid_key2 = "2203794861138657280";
 provider.getDriversInCell(grid_key,function(data){
 logger.log("drivers within grid cell = " +grid_key+"-"+ JSON.stringify(data));
 })*/