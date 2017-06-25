/**
 * Created by tinyiko on 2017/04/03.
 */
"use strict";

var s2 = require("nodes2ts");
var _ = require('underscore');
var _lo = require("lodash");
var redis = require("../redis/redisProvider").provider;
var init = require("../config/init");
var constant = require('../constants');
var s2circle = require("../s2geometry/s2circlecoverer");
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger;
var randomGeo = require("../shebeen/gpsRandomGenerator").randomGeo;
var xmlBuilderFactory = require("../shebeen/xmlBuilderFactory").xmlBuilderFactory;

String.prototype.padLeft = function(char, length) {
    return char.repeat(Math.max(0, length - this.length)) + this;
}

String.prototype.convertToLatLng = function(){
    var latlng =  new s2.S2CellId(this).toLatLng();
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

var tripRequest = (function(){

    function tripRequest(){
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
        })
        var cellsRegion = new s2.S2CellUnion();
        cellsRegion.initRawCellIds(s2_cellsB);
        cellsRegion.normalize();
        if(vehicles === null){
            cb(null);
            return;
        }
        logger.log("cellsRegion size = "+cellsRegion + "- vehicles = "+vehicles.length);

        var counter = 1;
        var vehiclesInRadius = vehicles.filter(function(item){
            var cell_item = new s2.S2CellId(item.s2key);
            return cellsRegion.contains(cell_item);

                /*counter++;
                logger.log( "filtered: vehicle id=/" + item.s2key +"/"+item.vehicle_id);
                return item;*/
            });

        logger.log("filterVehiclesInRadius old size = "+ vehicles.length + ", new size = "+vehiclesInRadius.length);
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
    tripRequest.getIntersectRadiusCells = function(min,max,no_of_cells,lat,lon,grid,radius,cb){

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,min,max,no_of_cells);

            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(grid);
            cityRegion.normalize();

            var riderRegion = new s2.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed

            if(intersect_union.size() > 0){
                cb(intersect_union);
            }else
            {
                cb(null);
            }
            logger.log ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");
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

    tripRequest.getVehiclesNearRider = function(lat,lon,grid,cb){
        var rider_radius = constant.RIDER_GEO_RADIUS;
        tripRequest.getIntersectRadiusCells(12,12,12,lat,lon,grid,rider_radius,function(cells){
                if(cells === null || cells.length === 0) {
                    logger.error("No cells intersecting near latlon, "+lat+","+lon);
                    return;
                };
                var cellArray = cells.getCellIds().map(function(item){
                    return item.pos().toString();
                });

                tripRequest.getIntersectRadiusCells(12,16,100,lat,lon,grid,rider_radius, function(cells12){

                    var cells_12 = cells12.getCellIds().map(function(item){
                        return item.pos().toString();
                    });

                        //retrieve from redis vehicles in rider cells within radius, start by retrieving
                        //all vehicles at level-12 and then filter cells within geo-radius (level 12 -16)
                        redis.getVehiclesInCellArray(cellArray).then(function(data){
                            var cellsWithVehicles = [];
                            data.forEach(function(item,index){
                                logger.log("No. of vehicles found = "+ item[1].length/2 +", in cell = "+ cellArray[index]);
                                if(item[1] !== null && item[1].length > 0){
                                    //logger.log(item);
                                    item[1].forEach(function(vehicle_id,index2){
                                        if(index2%2 === 0){
                                            //currently only retrieve 1 s2key under vehicle:xxxx, should we get the latest
                                            // 10-20 s2_position by timestamp age and filter to ensure is within rider cells
                                            var p = new posData(vehicle_id,cellArray[index])
                                            //logger.log("posData add to cellsWithVehicles = " + JSON.stringify(p));
                                            cellsWithVehicles.push(p);
                                        }
                                    })
                                }
                            });
                            redis.getRedisVehiclePositions(cellsWithVehicles,function(results){
                                //send both vehicles and all intersecting cells (with or without cars)
                                cb(results,cellArray,cells_12);
                            });
                        }).catch(function(error){
                            logger.log("getVehiclesNearRider, "+error.stack);
                            reject(error);
                        });
                });
            });
    }

    tripRequest.callGetVehiclesNear = function(lat,lon,grid)
    {
        tripRequest.getVehiclesNearRider(lat, lon,grid, function (vehicles, cells, cells_12) {
            var rectcell = s2common.createCellRectArray(cells);
            var rectcell_12 = s2common.createCellRectArray(cells_12);

            tripRequest.filterVehiclesInRadius(vehicles, cells_12, function (geoRadiusVehicles) {
                var tstamp = new Date().getTime();

                if (vehicles !== null) {
                    var vehicleArray = geoRadiusVehicles.map(function (item) {
                        //logger.log("vehicles = " + JSON.stringify(item));
                        return item.s2key.convertToLatLng();
                    });
                    logger.log("No. of vehicles = " + vehicles.length + "- new size = " + vehicleArray.length);
                    //geoRadiusVehicles.stringify();
                    var filename = "S2_vehicles_" + tstamp + ".kml";
                    xmlBuilderFactory.buildVehicleLocations(filename,vehicleArray, geoRadiusVehicles);
                }
                var file = "S2_cells_" + tstamp + ".kml";
                xmlBuilderFactory.buildCells(file,rectcell_12,null,"ffff6c91","2.1");
            })
        });
    }

    return tripRequest;
}).call(this)

exports.tripRequest = tripRequest;

var centerPoint = {
    latitude: -26.029613,
    longitude: 28.036167
    //-26.029246, 28.033959 - wroxham street, paulshof
};
/***
 * testing ......
 */

//-26.050388, 28.024187
//-26.088443,  28.074722

//-26.103217,  28.018408
//-26.184800,  28.036211
//-26.084080,  28.077604
//-26.084080,  28.077604 (0 vehicles)
//-26.198977,  28.042292 (Joburg)
//-26.142345,  28.037675 (Rosebank)
//-26.102310,  28.089150 (Alex)
//-26.011190,  28.200219 (Thembisa)
//-26.062455,  28.047267
//-26.137895,  28.237409 (OR Tambo)

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
redis.getCityGrid().then(function(grid) {
    tripRequest.callGetVehiclesNear(-26.023825,28.036000, grid);
});

//-26.029433325,28.033954797
//-26.217146, 28.356669
//-26.172133,28.079613 - No cells intersecting near latlon

//-26.023825,  28.036000 (3 vehicles)
//-26.023825,  28.036000 (2 vehicles)
//-26.114097,  28.156122 (0 vehicles)
//-26.059825,  28.021906 (8 vehicles - DD campus)
//-26.104628,  28.053901 (has 11 vehicles - sandton)
//-26.073009,  28.026688 (15 vehicles)
//-26.264848,  28.623590 (no vehicles)
//-26.057642,  28.022582 (cross main/william nicol - 9 vehicles)
//-26.054824,  28.071892 (woodmead)

//-26.038869,  28.030274 (near DD)

//-26.270155, 28.438425 (Spring - outside)
//-26.152353, 28.255995 (Boksburg - outside)
//27.8778444,-25.864647 (outside edge cells)
//-26.240749, 28.376074 ()
//-26.217146, 28.356669 (near the edge)
//-26.264848, 28.623590 (Delmas)
//-26.083709, 28.355121 (Benoni)
//-26.115579, 28.372062 (Benoni-2)
//-26.122485, 28.407961 (completely outside)
//-26.136211, 28.389541 (edge-case)