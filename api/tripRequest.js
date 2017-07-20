/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var s2 = require("nodes2ts");
var _ = require('underscore');
var _lo = require("lodash");
var redis = require("../redis/redisProvider").provider;
var path = require("path");
var fs   = require("fs");
var init = require("../config/init");
var constant = require('../constants');
var s2circle = require("../s2geometry/s2circlecoverer");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;
var randomGeo = require("../shebeen/gpsRandomGenerator").randomGeo;
var xmlBuilderFactory = require("../shebeen/xmlBuilderFactory").xmlBuilderFactory;
const util = require('util');

String.prototype.padLeft = function(char, length) {
    return char.repeat(Math.max(0, length - this.length)) + this;
}

String.prototype.convertToLatLng = function(){
    var latlng =  new s2.S2CellId(this).toLatLng();
    logger.log(latlng.latDegrees.toFixed(6)+","+latlng.lngDegrees.toFixed(6));
    return latlng.lngDegrees.toFixed(6)+","+latlng.latDegrees.toFixed(6);
}

Array.prototype.stringify = function(){
    this.forEach(function(item,index){
        if(item === undefined){
            //logger.log("vehicle at index = "+index + ", is removed");
        }else {
            logger.log(JSON.stringify(item));
        }
    })
}

var filename = path.resolve(__dirname, '../../goSwift-dispatch/redis/lua/geo-radius.lua');
var lua_script = fs.readFileSync(filename, {encoding: 'utf8'});
//logger.log("loading lua_script.....from "+filename);

var tripRequest = (function(){

    function tripRequest(){
    };

    var vehiclePosition = function (id, key, lat, lon) {
        this.vehicle_id = id;
        this.s2_position = key;
        this.latitude = lat;
        this.longitude = lon;
    };

    tripRequest.logRiderLocation = function(lat,lon,rider_UUID,mobile_number){
        var s2Latlong = new s2.S2LatLng(lat,lon);
        var s2riderCellId = new s2.S2CellId(s2Latlong);
    }

    /**
     * retrieve cells in customer rectangle that intersect with city-grid
     * @param rect
     */
    //getRiderGeoSquare
    tripRequest.getIntersectSquareCells = function(rect,grid){

            /*var lo = new s2.S2LatLng.fromDegrees(-26.135891, 28.117186);
            var hi = new s2.S2LatLng.fromDegrees(-26.129719, 28.131236);
            var riderSquare = s2.S2LatLngRect.fromLatLng(lo, hi);*/

            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(grid);
            cityRegion.normalize();

            var riderSquare = s2circle.S2CircleCoverer.getSquareCovering(rect, 12, 16, 100);
            var riderRegion2 = new s2.S2CellUnion();
            riderRegion2.initRawCellIds(riderSquare);
            riderRegion2.normalize();

            var intersect_union = new s2.S2CellUnion();
            intersect_union.getIntersectionUU(cityRegion,riderRegion2); //Google S2 bug fixed
            logger.debug ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion2.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");

    }

    /**
     * get intersection of cells and vehicle positions by filtering vehicles that are
     * within the geo-radius of the rider cells (estimated by the region coverer). These
     * cells are of level 12 - level 16 and should be valid cells (city grid)
     * @param vehiclePositions
     * @param cellsB
     * @param cb
     */
    tripRequest.filterVehiclesInRadius = function(vehicles, cellsB, cb){
        var s2_cellsB = cellsB.map(function(item){
            return new s2.S2CellId(item);
        });
        var cellsRegion = new s2.S2CellUnion();
        cellsRegion.initRawCellIds(s2_cellsB);
        cellsRegion.normalize();
        if(vehicles === null){
            cb(null);
            return;
        }

        var counter = 1;
        var vehiclesInRadius = vehicles.filter(function(item){
            var cell_item = new s2.S2CellId(item.cell_id[0]);
            //var cell_item = new s2.S2CellId(item.cell_id);
            return cellsRegion.contains(cell_item);
        });

        logger.log("Vehicles within radius (cell-12) = "+ vehicles.length
            + ", filtered radius = "+vehiclesInRadius.length);
        cb(vehiclesInRadius);
    }

    /**
     * get s2 cell union representing intersection of rider and city region
     * @param min
     * @param max
     * @param no_of_cells
     * @param lat
     * @param lon
     * @param grid
     * @param radius
     * @param cb
     */
    tripRequest.getIntersectRadiusCells = function(min,max,no_of_cells,lat,lon,cityRegion,radius,cb){

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,min,max,no_of_cells);

            //can we keep this in memory to avoid initializing s2 region for each geo-radius query?
            var riderRegion = new s2.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            //console.log("rider cells = "+riderRegion);
            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed

            if(intersect_union.size() > 0){
                cb(intersect_union);
            }else
            {
                //should we send an empty cell structure here to avoid current error
                logger.log("No intersection cells?");
                cb(null);
            }
    }

    /**
     * retrieve cells from city grid cells that intersect customer circle
     * @param lat
     * @param lon
     * @param grid
     * @param radius
     * @param cb
     */
    tripRequest.getRiderRadius = function(lat,lon,grid,radius,cb){

            var min = constant.S2_CELL_MIN_LEVEL;
            var max = constant.RIDER_S2_MAX_LEVEL;
            var no_of_cells = constant.DEFAULT_RIDER_MAX_CELLS;
            this.getIntersectRadiusCells(min,max,no_of_cells,lat,lon,grid,radius,cb);
    }

    /**
     * Retrieve vehicles that are within the radius of the rider requesting a trip.
     * (see RIDER_GEO_RADIUS in constants.js)
     * @param lat
     * @param lon
     * @param cb
     */

    var posData = function(id,cell){
        this.vehicle_id = id;
        this.cell_id = cell;
    };

    /**
     * code used to display rider cells information. Vehicle s2 positions are
     * stored under each vehicle_id (vehicle:id key) and their id is also stored
     * under level-12 cell. To retrieve vehicles near rider we calculate an intersection
     * of cells using a region-coverer that estimates a radius (constant.RIDER_GEO_RADIUS).We start
     * by retrieving all vehicles in level-12 cells that are touched by the geo-radius region. Then we
     * filter the returned vehicles and narrow down to vehicles contained inside the geo-radius region
     * which is made up (estimated) by cells of level 12 - level 16
     * @param lat, rider latitude
     * @param lon, rider longitude
     * @param grid, city grid (valid cells)
     * @param cb
     */

    tripRequest.getVehiclesNearRider = function(lat,lon,grid,rider_radius,cb){
        //12,12,12 - quadcells
        tripRequest.getIntersectRadiusCells(12,12,12,lat,lon,grid,rider_radius,function(quad_cells){
                if(quad_cells === null || quad_cells.size() === 0) {
                    return;
                };
                var cellArray = quad_cells.getCellIds().map(function(item){
                    return item.pos().toString();
                });
                //12,16,100 - radius-cells
                tripRequest.getIntersectRadiusCells(12,16,100,lat,lon,grid,rider_radius, function(circle_cells){
                    var cells_12 = circle_cells.getCellIds().map(function(item){
                        return item.pos().toString();
                    });

                    redis.redisVehiclesInCellArray(cellArray,lua_script,function(err, data){
                        cb(data,cellArray,cells_12);
                    });
                });
            });
    }

    /**
     * get all vehicles in city grid
     * @param lat
     * @param lon
     * @param grid
     * @param rider_radius
     * @param cb
     */
    tripRequest.getAllVehiclesInGrid = function(lat,lon,grid,rider_radius,cb){

        tripRequest.getIntersectRadiusCells(12,12,12,lat,lon,grid,rider_radius,function(cells){
            if(cells === null || cells.size() === 0) {
                return;
            };
            var quad_cells = cells.getCellIds().map(function(item){
                return item.pos().toString();
            });
            tripRequest.getIntersectRadiusCells(12,16,100,lat,lon,grid,rider_radius, function(cells12){
                var rider_cells = cells12.getCellIds().map(function(item){
                    return item.pos().toString();
                });

                redis.redisVehiclesInCellArray(quad_cells,lua_script,function(err, data){
                    cb(data,quad_cells,rider_cells);
                });
            });
        });
    }

    /**
     * get vehicles near rider latlong within city grid
     * @param lat
     * @param lon
     * @param grid, pass valid cells (i.e. city grid cells level 12-14)
     */
    tripRequest.callGetVehiclesNear = function(lat,lon,rider_radius,grid,cb)
    {
        var start_time = new Date().getTime();
        var vehicle_no = 0;
        //tripRequest.getVehiclesNearRider(lat, lon,grid,rider_radius, function (vehicles, cells, cells_12) {
        tripRequest.getAllVehiclesInGrid(lat, lon,grid,rider_radius, function (allvehicles, cells, radius_cells) {
            var vehicles = allvehicles /*.filter(function(e){
                return e
            }); //remove empty elements*/

            logger.log(util.inspect(vehicles, {depth: null, colors: true}))
            tripRequest.filterVehiclesInRadius(vehicles, radius_cells, function (filteredVehicles) {
                var tstamp = new Date().getTime();
                logger.log("time elapsed = "+ (new Date().getTime() - start_time));
                if (vehicles !== null) {
                    var vehicleLatLng = filteredVehicles.map(function (item) {
                        var cell_id_ = item.cell_id[0];
                        //var cell_id_ = item.cell_id;
                        var latlon = new s2.S2CellId(cell_id_).toLatLng();
                        var lat = parseFloat(latlon.latDegrees.toFixed(6));
                        var lon = parseFloat(latlon.lngDegrees.toFixed(6));

                        var vehicle = new vehiclePosition(item.vehicle_id,cell_id_,lat,lon);
                        return vehicle;
                    });

                    logger.log("No. of vehicles = " + vehicles.length + "- new size = " + vehicleLatLng.length);
                    var filename = "S2_vehicles_" + tstamp + ".kml";
                    var rider_latlng = lon +","+lat;
                    vehicle_no = vehicleLatLng.length;
                    if(vehicleLatLng.length > 0 ) {
                        //var rider_geofence = s2common.createCellRectArray(radius_cells);
                        //xmlBuilderFactory.buildVehicleLocations(filename, rider_latlng, vehicleLatLng);
                    }
                    cb(vehicleLatLng);
                }
                if(vehicle_no > 0) {
                    var file = "S2_cells_" + tstamp + ".kml";
                    //xmlBuilderFactory.buildCells(file, rider_geofence, null, "ffff6c91", "2.1");
                }
            });
        });
    }

    return tripRequest;
}).call(this)

exports.tripRequest = tripRequest;

var centerPoint = {
    latitude: -26.115622,
    longitude: 28.079382
};
/***
 * testing ......
 */

var distance = 22000;//in meters
/*randomGeo.createRandomGPSPositions(centerPoint,distance,1,function(data){
    redis.getCityGrid().then(function(grid){
        data.forEach(function(gps_point, index){
            //logger.log(gps_point.latitude +","+gps_point.longitude);
            tripRequest.callGetVehiclesNear(gps_point.latitude,gps_point.longitude,grid);
            logger.log("called getVehicleNear for vehicle number = "+index);
        });
    })
});*/
//---------current test------------
/*
redis.getCityGrid().then(function(grid) {
    //var rider_radius = constant.RIDER_GEO_RADIUS;
    var rider_radius = 2600;
    tripRequest.callGetVehiclesNear( -26.057134,28.103682,rider_radius ,grid,function(results){
        console.log("Vehicles near = " + results.length);
    });
});
*/

