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
var logger = require("../config/logutil").logger;
var randomGeo = require("../shebeen/gpsRandomGenerator").randomGeo;

const Promise = require('bluebird');

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
    driverLocation.method1 = function(vehicle_id,lat,lon){
        return new Promise(function(resolve,reject) {
            //logger.log(vehicle_id +"-"+lat+","+lon);
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
                logger.log("-----getCurrentCellByVehicleId");
                resolve(data)
                //return data;
            }).catch(function (err) {
                logger.log(err);
                reject(err);
            })
        })
    }

    driverLocation.method2 = function(results) {
        return new Promise(function (resolve, reject) {
            //function (results) {
            //check new-cell and compare with current-cell, if not the same, changeCellLocation
            if (results.new_cellid !== results.current_cell) {
                results.new_cellid === results.current_cell ? logger.log("No changes to cell: " + results.new_cellid)
                    : logger.log("Changed cells from = " + results.current_cell + " to > " + results.new_cellid);
                redis.changeCellPosition(results.current_cell, results.new_cellid, results.id, results.tstamp).then(function(data){
                    logger.log("changeCellPos = " + data);
                    resolve(results);
                    //return results;
                }).catch(function(err){
            reject(err);
            })
            }
           //return results;
        })
    }

    driverLocation.method3 = function(results){
        return new Promise(function(resolve,reject){
            redis.addVehiclePosition(results.s2key, results.id, results.timestamp).then(function(data){
                logger.log("addVehiclePos = " + data);
                resolve(data);
            }).catch(function(err){
                reject(err);
            })
        });
    }

    driverLocation.logDriverGPSLocation = function (data) {
        ////new Promise(function(resolve,reject){
        logger.log(data.latitude +","+data.longitude);
        return driverLocation.method1(data.vehicle_id, data.latitude, data.longitude)
            .then(driverLocation.method2)
            .then (driverLocation.method3)
            .catch(function(error){
                logger.log("Error in getCurrentCellByVehicleId : " + error.stack);
            });
            //resolve();
         //});
    }

    return driverLocation;
}).call(this);

exports.driverLocation = driverLocation;

//driverLocation.listDriversInRadius("2203795001640038161", 100);
//-26.155397,28.071016
//-26.146402,28.074747
//-26.15901,28.101125

//driverLocation.logDriverGPSLocation("4524",-26.155397,28.071016);

//Paulshof_waypoints
var filename = "Taxi_locations_13June_1.txt";
var file = path.join(__dirname,"../../GoSwift/docs/S2/routes",filename);
//'/Users/tinyiko/WebstormProjects/GoSwift/docs/S2/routes/Taxi_locations_13June_1.txt'

/*commons.readDriversGPS(file)
    .then(function(data){

    runPromisesSeq(data, driverLocation.logDriverGPSLocation,function(){
        console.log("finished --- " + data);
    });
}).catch(function(error){
    logger.log(error.stack)
})*/
var centerPoint = {
    latitude: -26.029613,
    longitude: 28.036167
}
randomGeo.createRandomGPSPositions(centerPoint,22000,600,function(data){
    var data2 = data.map(function(item){
        logger.log(item.latitude + ","+item.longitude);
        return {
            vehicle_id: "4524",
            latitude:item.latitude,
            longitude:item.longitude
        }
    });
    logger.log("data2 = " + data2.length);

    runPromisesSeq(data2, driverLocation.logDriverGPSLocation);
});

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