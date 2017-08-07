/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var s2 = require("nodes2ts");
var express = require("express");
var redis = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var commons = require("../commonUtil");
var path = require("path");
var fs = require("fs");
var logger = require("../config/logutil").logger;
var randomGeo = require("../shebeen/testGPSRandomGenerator").randomGeo;
var script = null;

const Promise = require('bluebird');

var filename = path.resolve(__dirname, '../redis/lua/log-driver.lua');
script = fs.readFileSync(filename, {encoding: 'utf8'});
console.log("loading lua script for driverLocation...."+script.length);

var driverLocation = (function () {

    function driverLocation() {
    };

    /**
     * given a leaf cell and a level, return its parent at that level
     * @param s2cell
     * @param parent_level
     * @returns {null}
     */
    driverLocation.getParentCellAtlevel = function (s2cell_id, parent_level) {
        if (isNaN(s2cell_id) || isNaN(parent_level) || parent_level < 1 || parent_level > 30) {
            throw new Error("'level' not valid, must be a number between 1 and 30");
        }
        var s2cell = new s2.S2CellId(s2cell_id);
        var s2Parent = s2cell.parentL(parent_level);
        logger.trace("Parent id=" + s2Parent.id + "->level = " + parent_level);
        logger.trace("binary key ->" + commons.decimalToBinary(s2Parent.id));
        return s2Parent;
    }

    driverLocation.EarthMetersToRadians = function (meters) {
        return (2 * Math.PI) * (meters / EARTH_CIRCUMFERENCE_METERS);
    }

    /**
     * list drivers within radius of customer centrepoint
     * @param cust_latlng
     * @param radius
     */
    driverLocation.listDriversInRadius = function (driverKey, radius) {
        var cap = driverLocation.getS2CapFromKey(driverKey, radius);
        redis.getDriverPositions(driverKey, function (driver) {
            driver.forEach(function (each_driver) {
                var driver_s2cellid = new s2.S2CellId(each_driver);
                logger.log("each driver = " + each_driver);
                var driver = driverLocation.getS2CapFromKey(each_driver, 0);
                if (cap.contains(driver_s2cellid.toPoint())) {
                    logger.log("Testing....contains..." + each_driver);
                }
                logger.log("-------------------------------------");
            });
        });
    }

    /**
     * get S2Cap given an axis height and a LatLng
     * @param latLng
     * @param meters
     * @returns {s2.S2Cap}
     */
    driverLocation.getS2CapFromKey = function (key, meters) {
        //if(latLng !== null && typeof(latLng) === 'object') {
        if (isNaN(key) === false) {
            var s2_point = new s2.S2CellId(key).toPoint();
            var radius_radians = s2common.EarthMetersToRadians(meters);
            var axis_height = (radius_radians * radius_radians) / 2;
            var cap = new s2.S2Cap(s2_point, axis_height);
            return cap;
        }
    }

    /**
     * get bounding rectangle for S2Cap with a given radius and centre point
     * @param point
     * @param radius
     * @returns {rectangle}
     */
    driverLocation.getS2CapRectBound = function (latLng, radius_meters) {
        if (latLng !== null && typeof(latLng) === 'object') {
            var cap = driverLocation.getS2CapAtLatLng(latLng, radius_meters);
            var rect = cap.getRectBound();
            //logger.debug("radius ->" + axis_height + "\n"+"area ->" + rect.size());
            return rect;
        }
    }

    /**
     * get S2 cell approximate area given a leaf cell and a level
     * review whether we should pass an S2CellId or S2Cell
     */
    driverLocation.getS2CellAreaOfParent = function (s2cell, level) {
        if (s2cell.isLeaf() && level < s2cell.level()) {
            var cell_id = getParentCellAtlevel(s2cell, level);
            var s2cell = new s2.S2Cell(cell_id);
            var size = s2cell.approxArea();
            logger.debug("size of cell at level ->" + level + "=" + size);
        }
        return size;
    }

    driverLocation.addDriversFromFile = function () {
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump2.csv';
        s2common.readDrivers(filename).then(function (data) {
            //unreached = data;
            data.forEach(function (each_driver) {
                var lat = each_driver.latitude;
                var lon = each_driver.longitude;
                driverLocation.logDriverGPSLocation("000121", "0767892416", lat, lon);
            });
        }).catch(function (err) {
            console.log(err);
            logger.debug("error message = " + err);
        });
    }

    /**
     * function to log driver GPS in redis. The redis service
     * checks first which cell does this GPS point belong to and it
     * logs it into city_cells:xxxxx (where xxxx is cell_id of grid)
     * @param user_id
     * @param mobile
     * @param lat
     * @param lon
     */
    driverLocation.currentVehicleCell = function(vehicle_id, lat, lon){
        return new Promise(function(resolve,reject) {
            redis.getCurrentCellByVehicleId(vehicle_id).then(function (current_cell) {
                var s2_cellid = s2common.s2CellIdKeyFromLatLng(lat, lon);
                var new_cellid = s2common.getParentIdAtLevel(12, s2_cellid);

                var tstamp = new Date().getTime();
                var results_data = function (location_key, new_cell, cur_cell, vehicle_id, tstamp) {
                        this.s2key = location_key,
                        this.new_cellid = new_cell,
                        this.current_cell = cur_cell,
                        this.id = vehicle_id,
                        this.timestamp = tstamp
                };
                var data = new results_data(s2_cellid, new_cellid, current_cell[0], vehicle_id, tstamp);
                resolve(data);
                //return data;
            }).catch(function (err) {
                logger.log("currentVehicleCell ->"+err.stack);
                reject(err);
            })
        })
    }

    driverLocation.changeCellPos = function(position) {
        return new Promise(function (resolve, reject) {
            //check new-cell and compare with current-cell, if not the same, changeCellLocation
            if (position.new_cellid !== position.current_cell) {

                    redis.changeCellPosition(position.current_cell, position.new_cellid, position.id, position.timestamp)
                    .then(function(data){
                        //logger.log("changeCellPos = " + data);
                        resolve(position);
                    //return results;
                }).catch(function(err){
                    logger.log("changeCellPos ->"+err.stack);
                    //reject(err);
                });
            }
            else{
                resolve(position);
            }
        });
    }

    driverLocation.changeVehiclePos = function(results){
        return new Promise(function(resolve,reject){
            redis.addVehiclePosition(results.s2key, results.id, results.timestamp)
                .then(function(data){
                //logger.log("addVehiclePos = " + data);
                resolve(data);
            }).catch(function(err){
                logger.log("changeVehiclePos ->"+err.stack);
                //reject(err);
            })
        });
    }

    /*
    driverLocation.logDriverGPSLocation = function (data) {
        ////new Promise(function(resolve,reject){
        logger.log(data.latitude +","+data.longitude);
        return driverLocation.currentVehicleCell(data.vehicle_id, data.latitude, data.longitude)
            .then(driverLocation.changeCellPos)
            .then (driverLocation.changeVehiclePos)
            .catch(function(error){
                logger.log("Error in getCurrentCellByVehicleId : " + error.stack);
            });
            //resolve();
      //});
    }*/

    driverLocation.logDriverLocation = function(vehicle_id,lat,lon){
        if(isNaN(vehicle_id)){
            throw Exception("vehicle_id invalid, vehicle_id = "+vehicle_id);
        }
        var s2_cellid = s2common.s2CellIdKeyFromLatLng(lat,lon);
        var new_cellid = s2common.getParentIdAtLevel(12, s2_cellid);
        var startTime = new Date().getTime();
        //console.log("script = "+script.length);
        redis.redisAddDriverPosition(script,vehicle_id,startTime,new_cellid,s2_cellid,function(error,results){
            if(error){
                console.log(error);
            }
            else{
                console.log("Driver position added latlng = "+lat+","+lon+"->"+results);
            }
        });
    }

    return driverLocation;
}).call(this);

exports.driverLocation = driverLocation;

//driverLocation.logDriverGPSLocation("4524",-26.155397,28.071016);

/*var filename = "Taxi_locations_13June_1.txt";
var file = path.join(__dirname,"../../GoSwift/docs/S2/routes",filename);
commons.readDriversGPS(file,"4528")
    .then(function(data){
    runPromisesSeq(data, driverLocation.logDriverGPSLocation,function(){
        console.log("finished --- ");
    });
}).catch(function(error){
    logger.log(error.stack)
});*/
var centerPoint = {
    latitude: -26.074234, //,-26.029613
    longitude: 28.050480  //,28.036167
}

/*
randomGeo.createRandomGPSPositionsSync(centerPoint,16345,100000,"4592").then(function(random_gps) {
    var tstamp1 = new Date().getTime();
    var filename = path.resolve(__dirname, '../redis/lua/log-driver.lua');
    var script = fs.readFileSync(filename, {encoding: 'utf8'});
    logger.log("loading lua_script.....from "+filename);

    random_gps.forEach(function(item,index){
        var s2_cellid = s2common.s2CellIdKeyFromLatLng(item.latitude,item.longitude);
        var new_cellid = s2common.getParentIdAtLevel(12, s2_cellid);
        if(index % 100 === 0){
            logger.log("vehicle ="+item.vehicle_id + ">"+new_cellid+"-"+s2_cellid);
        }
        var startTime = new Date().getTime()
        redis.redisAddDriverPosition(script,item.vehicle_id,startTime,new_cellid,s2_cellid,function(error,results){
            //logger.log("finished with lua, duration = " + (new Date().getTime() - tstamp1)/1000 +"seconds");
        });
    });
    logger.log("finished with lua lua_script, duration = " + (new Date().getTime() - tstamp1)/1000 +"seconds");
});

/*
randomGeo.createRandomGPSPositionsSync(centerPoint,22000,100000,"4531").then(function(data){
    var startTime = new Date().getTime()
    logger.log("data2 = " + data.length + "-start time - "+startTime);
    runPromisesSeq(data, driverLocation.logDriverGPSLocation).then(function(){
        logger.log((new Date().getTime() - startTime)/1000 + "seconds")
    })
});
 */

function runPromisesSeq(objects_array, iterator, callback) {
    var start_promise = objects_array.reduce(function (prom, object) {
        return prom.then(function () {
            return iterator(object);
        });
    }, Promise.resolve()); // initial
    if(callback){
        start_promise.then(callback);
    }else{
        return start_promise;
    }
}

