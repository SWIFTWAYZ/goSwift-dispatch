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

var driverLocation = (function(){

    function driverLocation(){
    };

    /**
     * given a leaf cell and a level, return its parent at that level
     * @param s2cell
     * @param parent_level
     * @returns {null}
     */
    driverLocation.getParentCellAtlevel = function(s2cell_id, parent_level){
        if (isNaN(s2cell_id) || isNaN(parent_level) || parent_level < 1 || parent_level > 30) {
            throw new Error("'level' not valid, must be a number between 1 and 30");
        }
        var s2cell = new s2.S2CellId(s2cell_id);
        var s2Parent = s2cell.parentL(parent_level);
        logger.trace("Parent id="+ s2Parent.id + "->level = " + parent_level);
        logger.trace("binary key ->"+commons.decimalToBinary(s2Parent.id));
        return s2Parent;
    }

    driverLocation.EarthMetersToRadians = function(meters) {
        return (2 * Math.PI) * (meters / EARTH_CIRCUMFERENCE_METERS);
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
    driverLocation.logDriverGPSLocation = function(user_id,mobile,lat,lon){
        var s2_cellid = s2common.s2CellIdKeyFromLatLng(lat,lon);
        //logger.debug("log drivers GPS = "+s2_cellid);
        redis.addDriverPosition(s2_cellid);
    }

    /**
     * list drivers within radius of customer centrepoint
     * @param cust_latlng
     * @param radius
     */
    driverLocation.listDriversInRadius = function(cust_latlng,radius) {
        var cap = getS2CapAtLatLng(cust_latlng, radius);

        //get all drivers in every cell for now. in future, we must optimize to get only drivers
        //in cells that intersect the customer spherical cap//use S2Region.getCovering() or similar
        var driver = redis.getDriverPositions();

        driver.forEach(function (each_driver) {
            var driver_s2cellid = new s2.S2CellId(each_driver);
            var driver = getS2CapAtLatLng(driver_s2latlng, 0);

            if (cap.contains(driver)) {
                logger.debug("is driver within radius?=" + radius + "->" +
                    cap.contains(driver));
            }
        });
    }

    /**
     * get S2Cap given an axis height and a LatLng
     * @param latLng
     * @param meters
     * @returns {s2.S2Cap}
     */
    driverLocation.getS2CapAtLatLng = function(latLng,meters) {
        if(latLng !== null && typeof(latLng) === 'object') {
            var radius_radians = EarthMetersToRadians(meters);
            var axis_height = (radius_radians * radius_radians) / 2;
            var cap = new s2.S2Cap(latLng.normalized().toPoint(), axis_height);
            return cap;
        }
    }

    /**
     * get bounding rectangle for S2Cap with a given radius and centre point
     * @param point
     * @param radius
     * @returns {rectangle}
     */
    driverLocation.getS2CapRectBound = function(latLng,radius_meters){
        if(latLng !== null && typeof(latLng) === 'object') {
            var cap = getS2CapAtLatLng(latLng,radius_meters);
            var rect = cap.getRectBound();
            //logger.debug("radius ->" + axis_height + "\n"+"area ->" + rect.size());
            return rect;
        }
    }

    /**
     * get S2 cell approximate area given a leaf cell and a level
     * review whether we should pass an S2CellId or S2Cell
     */
    driverLocation.getS2CellAreaOfParent = function(s2cell,level){

        if(s2cell.isLeaf() && level < s2cell.level() ){
            var cell_id = getParentCellAtlevel(s2cell,level);
            var s2cell = new s2.S2Cell(cell_id);
            var size = s2cell.approxArea();
            logger.debug("size of cell at level ->" + level + "=" + size);
        }
        return size;
    }

    driverLocation.addDriversFromFile = function(){
        var filename = '/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump2.csv';
        s2common.readDrivers(filename).then(function (data) {
            //unreached = data;
            data.forEach(function (each_driver) {
                var lat = each_driver.latitude;
                var lon = each_driver.longitude;
                driverLocation.logDriverGPSLocation("000121","0767892416",lat,lon);
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
driverLocation.getParentCellAtlevel("2203794861138640897",12);