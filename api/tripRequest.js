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
var logger = require("../config/logutil").logger
var xmlBuilderFactory = require("../shebeen/xmlBuilderFactory").xmlBuilderFactory;

var tripRequest = (function(){

    function tripRequest(){
    };

    tripRequest.logRiderLocation = function(lat,lon,rider_UUID,mobile_number){
        var s2Latlong = new s2.S2LatLng(lat,lon);
        var s2riderCellId = new s2.S2CellId(s2Latlong);

        var driver_data = {
            key: s2riderCellId.id.toString(),
            lat:lat,
            lon:lon,
            date_time: new Date(),
            driver_uuid: rider_UUID,
            driver_mobile: mobile_number
        };
    }

    /**
     * retrieve cells in customer rectangle that intersect with city-grid
     * @param rect
     */
    //getRiderGeoSquare
    tripRequest.getIntersectSquareCells = function(rect){
        redis.getCityGrid(function(data){
            var lo = new s2.S2LatLng.fromDegrees(-26.135891, 28.117186);
            var hi = new s2.S2LatLng.fromDegrees(-26.129719, 28.131236);
            var riderSquare = s2.S2LatLngRect.fromLatLng(lo, hi);

            logger.info("city lat_lon = " + init.city.lat+","+init.city.lon);
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();
            var riderSquare = s2circle.S2CircleCoverer.getSquareCovering(riderSquare, 12, 20, 100);
            var riderRegion2 = new s2.S2CellUnion();
            riderRegion2.initRawCellIds(riderSquare);
            riderRegion2.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion2); //Google S2 bug fixed
            logger.debug ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion2.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");

        });
    }
    /**
     * retrieve cells from city grid cells that intersect customer circle
     * @param cust_scap
     */

    tripRequest.getIntersectRadiusCells = function(lat,lon,radius,cb){
        redis.getCityGrid(function(data){
            var min = constant.S2_CELL_MIN_LEVEL;
            var max = constant.RIDER_S2_MAX_LEVEL;
            var no_of_cells = constant.DEFAULT_RIDER_MAX_CELLS;

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,min,max,no_of_cells);
            //logger.log("city lat_lon = " + init.city.lat+","+init.city.lon);
            //do we actually need the city latlon to initialize S2CellUnion?
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();

            var riderRegion = new s2.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed

            logger.log ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");
            cb(intersect_union);
        });
    }

    /**
     * Retrieve vehicles that are within the radius of the rider requesting a trip.
     * (see RIDER_GEO_RADIUS in constants.js)
     * @param lat
     * @param lon
     * @param cb
     */

    var posData = function(x,cell){
        this.x = x;
    this.cell_id = cell;
};
    tripRequest.getVehiclesNearRider = function(lat,lon,cb){
        logger.log("rider location = " + lat+","+lon);
        tripRequest.getIntersectRadiusCells(lat,lon,
            constant.RIDER_GEO_RADIUS,function(cells){
                var cellArray = cells.getCellIds().map(function(item){
                    return item.pos().toString();
                });

                /**
                 * code used to display rider cells information
                 */

                var vertex = s2common.getVertexArrayfromCells(cellArray);
                logger.log("Vertex array = "+ vertex.length);
                //var s2cells = s2common.getVertexArrayfromCells(cells);
                xmlBuilderFactory.buildCells("S2_Paulshof_cells.kml",vertex,null,"#ff3eff3e","2.1");

                //retrieve from redis vehicles in rider cells within radius
                redis.getVehiclesInCellArray(cellArray).then(function(data){
                    var cellsWithVehicles = [];
                    data.forEach(function(item,index){
                        logger.log("cell_id = " + cellArray[index] +"-"+ item[1].length/2);
                        if(item[1] !== null && item[1].length > 0){
                            //logger.log(item);
                            item[1].forEach(function(x,index2){
                                if(index2%2 === 0){
                                    //currently only retrieve 1 s2key under vehicle:xxxx, should we get the latest
                                    // 10 or 20 s2keys by timestamp age and filter to ensure is within rider cells
                                    logger.log("push vehicle = "+ x + "->"+cellArray[index]);
                                    cellsWithVehicles.push(new posData(x,cellArray[index]));
                                }
                            })
                        }
                    });
                    redis.getVehiclePosFromArray(cellsWithVehicles,function(results){
                        cb(results);
                    });
                }).catch(function(error){
                    logger.log("getVehiclesNearRider, "+error.stack);
                    reject(error);
                });
            });
    }

    return tripRequest;
}).call(this)

exports.tripRequest = tripRequest;

String.prototype.padLeft = function(char, length) {
    return char.repeat(Math.max(0, length - this.length)) + this;
}

String.prototype.convertToLatLng = function(){
    var latlng =  new s2.S2CellId(this).toLatLng();
    return latlng.lngDegrees.toFixed(6)+","+latlng.latDegrees.toFixed(6);
}
/***
 * testing ......
 */
//triprequest.getIntersectRadiusCells(27.8778444,-25.86465,constant.RIDER_GEO_RADIUS);
//triprequest.getIntersectRadiusCells(-26.104628,28.053901,constant.RIDER_GEO_RADIUS);
//triprequest.getIntersectRadiusCells(27.8778444,-25.86465,constant.RIDER_GEO_RADIUS);
//-26.029433325,28.033954797
//-26.217146, 28.356669

//-26.023825, 28.036000 ( 3 vehicles)
//-26.023825, 28.036000  (2 vehicles)
//-26.114097,  28.156122 (0 vehicles)
//-26.059825,  28.021906 (8 vehicles)
//-26.104628,28.053901 (has 11 vehicles - sandton)
//-26.073008866,28.026688399 (has vehicles)
//-26.264848,  28.623590 (no vehicles)
//-26.057642,  28.022582 (cross main/william nicol - 9 vehicles)

tripRequest.getVehiclesNearRider(-26.136211, 28.389541,function(vehicles){
    //var val = _.isArray(vehicles);
    logger.log("---------------------------------------");
    if(vehicles === null){
        return null;
    }
    logger.log("getVehiclesNear = "+ vehicles.length);
    vehicles.forEach(function(vehicle){
        //console.log("adf".padLeft('0',6));
        var vehiclePos = vehicle.s2key;
        var vehicle_gps =  vehicle.s2key.convertToLatLng();
        logger.log(vehicle.vehicle_id.padLeft('0',6)+"->"+vehiclePos + "/"
           + vehicle_gps+ "=/"+vehicle.tstamp + "--/"+vehicle.cell + "-"+vehicle.vehicle_id);

    });

    var vehicleArray = vehicles.map(function(item){
        return item.s2key.convertToLatLng();
    });

    var s2_vehicles = vehicles.map(function(item){
        //return item.vehicle_id + "/"+item.s2key;
        return item.s2key;
    })
    var xmlBuilder = xmlBuilderFactory.buildWayPoints("S2_Edenvale_cells.kml",vehicleArray,s2_vehicles);
});
//-26.270155, 28.438425 (Spring - outside)
//-26.152353, 28.255995 (Boksburg - outside)
//27.8778444,-25.864647 (outside edge cells)
//-26.240749, 28.376074 ()
//-26.217146, 28.356669 //near the edge

//-26.264848,  28.623590 (Delmas)
//-26.083709,  28.355121 (Benoni)
//-26.115579,  28.372062 (Benoni-2)
//-26.122485,  28.407961 (completely outside)
//-26.136211, 28.389541 (edge-case)