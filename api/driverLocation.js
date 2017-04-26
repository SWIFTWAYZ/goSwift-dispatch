/**
 * Created by tinyiko on 2017/04/03.
 */

var s2 = require("nodes2ts");
var express = require("express");
var redisService = require("../redis/redisProvider");
var s2common = require("../s2geometry/s2common");
var bigInt = require("big-integer");

var redis = redisService.redisService;

/**
 * given a leaf cell and a level, return its parent at that level
 * @param s2cell
 * @param parent_level
 * @returns {null}
 */
function getParentCellAtlevel(s2cell, parent_level){
    if (isNaN(s2cell) || isNaN(parent_level) || parent_level < 1 || parent_level > 30) {
    throw new Error("'level' not valid, must be a number between 1 and 30");
  }
    console.log("typeof->"+s2cell.pos());
    var s2Parent = s2cell.parentL(parent_level);
    console.log("Parent id="+ s2Parent.id + "->level = " + parent_level);
    console.log("binary key ->"+s2common.decimalToBinary(s2Parent.id));
    return s2Parent;
}

function EarthMetersToRadians(meters) {
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
function logDriverGPSLocation(user_id,mobile,lat,lon){
    var s2_cellid = s2common.s2CellIdKeyFromLatLng(lat,lon);
    console.log("log drivers GPS = "+s2_cellid);
    //s2CellIDfromLatLng(lat,lon);
    redis.addDriverPosition(s2_cellid);
}

/**
 * list drivers within radius of customer centrepoint
 * @param cust_latlng
 * @param radius
 */
function listDriversInRadius(cust_latlng,radius) {
    var cap = getS2CapAtLatLng(cust_latlng, radius);

    //get all drivers in every cell for now. in future, we must optimize to get only drivers
    //in cells that intersect the customer spherical cap//use S2Region.getCovering() or similar
    var driver = redis.getDriverPositions();

    driver.forEach(function (each_driver) {
        var driver_s2cellid = new s2.S2CellId(each_driver);
        var driver = getS2CapAtLatLng(driver_s2latlng, 0);

        if (cap.contains(driver)) {
            //redis.addDriverPosition(redis.driver_hashset, driver_s2cellid.id());
            console.log("is driver within radius?=" + radius + "->" +
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
function getS2CapAtLatLng(latLng,meters) {
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
function getS2CapRectBound(latLng,radius_meters){
    if(latLng !== null && typeof(latLng) === 'object') {
        var cap = getS2CapAtLatLng(latLng,radius_meters);
        var rect = cap.getRectBound();
        //console.log("radius ->" + axis_height + "\narea ->" + rect.size());
        return rect;
    }
}

/**
 * get S2 cell approximate area given a leaf cell and a level
 * review whether we should pass an S2CellId or S2Cell
 */
function getS2CellAreaOfParent(s2cell,level){

    if(s2cell.isLeaf() && level < s2cell.level() ){
        var cell_id = getParentCellAtlevel(s2cell,level);
        var s2cell = new s2.S2Cell(cell_id);
        var size = s2cell.approxArea();
        console.log("size of cell at level ->" + level + "=" + size);
    }
    return size;
}

function addDriversFromFile(){
    s2common.readDrivers(function(data) {
    }).then(function (data) {
        unreached = data;
        data.forEach(function (each_driver) {
            //can do distance calc here
            //console.log("each driver->"+JSON.stringify(each_driver));
            lat = each_driver.latitude;
            lon = each_driver.longitude;
            var s2cellid = s2common.s2CellIDfromLatLng(lat,lon)

            logDriverGPSLocation("000121","0767892416",lat,lon);
            //cb(reached);
            //redis.getCityCellPosition or createCityCellPosition
            //redis.addDriverPosition(redis.driver_hashset,s2cellid);
        });

    }).catch(function (err) {
        console.log("error message = " + err);
    });
}

//37.770174,-122.424109 (San Francisco) - face (100)
//44.0378862, 10.0458712 (Italy) - face (100)
//35.669396,139.696042 (Tokyo) - face (110)
//5.600254,-0.178466 (Accra) - face (111)
//-26.104628,28.053901 (Joburg) - face (111)
//-5.790916,141.405155 (New Zealand)
//74.505182,-43.623446
//-14.803729,-153.845548

//logDriverLocation(-26.166329,28.148618,"00002345","0847849574");
//logDriverGPSLocation("tin2yiko",'0847849574',-26.1309030,28.340768);
//logDriverGPSLocation("tin2yiko",'0847849574',-26.367327,28.345615);

addDriversFromFile();

/*var s2latlng = new s2.S2LatLng(-26.267329,28.149618);

var radius_rect = getS2CapRectBound(s2latlng,18000);
console.log("size of rect " + radius_rect.size + radius_rect.getVertex(0));
console.log("size of rect " + radius_rect.getVertex(1));
console.log("size of rect " + radius_rect.getVertex(2));
console.log("size of rect " + radius_rect.getVertex(3));*/

