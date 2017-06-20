/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var s2 = require("nodes2ts");
var express = require("express");
var redis = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var commons = require("../commonUtil");
var logger = require("../config/logutil").logger;

var driverLocation = (function () {

    function driverLocation() {
    };

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
        return new Promise(function(resolve,reject){
            //function (current_cell) {
                //return new Promise(function(resolve,reject){
                /*if (current_cell.length > 1) {
                    logger.log("more than 1 current cells = " + current_cell.length);
                }*/

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
                //logger.log(JSON.stringify(s2_cellid));
                //resolve(data);
                logger.log("-----getCurrentCellByVehicleId");
                resolve(data)
                //return data;
        });
    }

    driverLocation.method2 = function(results) {
        return new Promise(function (resolve, reject) {
            //function (results) {
            //check new-cell and compare with current-cell, if not the same, changeCellLocation
            if (results.new_cellid !== results.current_cell) {
                results.new_cellid === results.current_cell ? logger.log("No changes to cell: " + results.new_cellid)
                    : logger.log("Changed cells from = " + results.current_cell + " to > " + results.new_cellid);
                logger.log("-----changeCellPosition");
                redis.changeCellPosition(results.current_cell, results.new_cellid, vehicle_id, results.tstamp);
            }
            logger.log("-----addVehiclePosition");
            redis.addVehiclePosition(results.s2key, results.id, results.timestamp);
            resolve();
        })
    }

    driverLocation.logDriverGPSLocation = function (vehicle_id, lat, lon) {
       // return new Promise(function(resolve,reject){
            return redis.getCurrentCellByVehicleId(vehicle_id)
                .then(driverLocation.method1(vehicle_id,lat,lon))
                .then(driverLocation.method2)
                .catch(function(error){
                    logger.log("Error in getCurrentCellByVehicleId : " + error.stack);
                });
           // });
    }

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

    return driverLocation;
}).call(this);

exports.driverLocation = driverLocation;

//driverLocation.addDriversFromFile();
//driverLocation.getParentCellAtlevel("2203794861138640897",12);

//driverLocation.listDriversInRadius("2203795001640038161", 100);
//-26.155397,28.071016
//-26.146402,28.074747
//-26.15901,28.101125

//driverLocation.logDriverGPSLocation("4524",-26.15901,28.101125);

commons.readDriversGPS('/Users/tinyiko/WebstormProjects/GoSwift/docs/S2/routes/Taxi_locations_13June_1.txt').then(function(data){
    logger.log(data.length);
    var promiseChain = [];

    data.forEach(function(item,index) {
        //logger.log(index + ", reading GPS = " + JSON.stringify(item));
        promiseChain.push(driverLocation.logDriverGPSLocation("4524",item.latitude,item.longitude));
    });

    Promise.all(promiseChain).then();

})

