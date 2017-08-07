/**
 * Created by tinyiko on 2017/04/09.
 *
 */
"use strict";

var s2 = require("nodes2ts");
var _ = require('underscore');
var constants = require("../constants");
var s2common = require("./s2common").s2common;
var redis = require("../redis/redisProvider").provider;
var logger = require("../config/logutil").logger;

function getS2CapRadius(latLng, radius_in_meters) {
    var s2cap_ts;
    if (latLng !== null && typeof(latLng) === 'object') {
        var radius_radians = s2common.EarthMetersToRadians(radius_in_meters);
        var axis_height = (radius_radians * radius_radians) / 2;
        s2cap_ts = new s2.S2Cap(latLng.normalized().toPoint(), axis_height);
        //var area = (2 * Math.PI * Math.max(0.0, axis_height)) * constants.KEARTH_CIRCUMFERENCE_METERS;
    }
    return s2cap_ts;
}

var S2CircleCoverer = (function () {
    var S2CircleCoverer,
        s2cap,
        axis_height;

    var S2CircleCoverer = {};

    /**
     * get a combination of cells at different levels as stipulated by the min,max and
     * cells constraints that approximate the covering of the spherical cap (lat,lot,radius)
     * @param lat
     * @param lon
     * @param radius
     * @param min
     * @param max
     * @param cells
     * @returns {null}
     */
    S2CircleCoverer.getCovering = function (lat, lon, radius, min, max, cells) {
        var counter = 0;
        var covering_area = 0;
        var covering = new s2.S2RegionCoverer();
        covering.setMinLevel(min);
        covering.setMaxLevel(max);
        covering.setMaxCells(cells);

        var centre_gps = new s2.S2LatLng.fromDegrees(lat, lon);
        var cap2 = getS2CapRadius(centre_gps, radius);
        //var cap2 = s2.Utils.calcRegionFromCenterRadius(centre_gps,2.680); //not working?

        var results = covering.getCoveringCells(cap2);

        /*
        results.forEach(function (record) {
            var cell = new s2.S2Cell(record);
            counter++;
            var cell_area = cell.approxArea() * constants.KEARTH_CIRCUMFERENCE_METERS;
            covering_area += cell_area;
        });*/

        return results;
    }

    /**
     * get covering for rectangle representing a city boundary
     * @param rect_latlng
     * @param min
     * @param max
     * @param cells
     */
    S2CircleCoverer.getSquareCovering = function (rect_latlng, min, max, cells) {
        var counter = 0;
        var covering_area = 0;
        var city_covering = new s2.S2RegionCoverer();
        city_covering.setMinLevel(min);
        city_covering.setMaxLevel(max);
        city_covering.setMaxCells(cells);

        var results = city_covering.getCoveringCells(rect_latlng);

        /*results.forEach(function (record) {
            var cell = new s2.S2Cell(record);
            counter++;
            var cell_area = cell.approxArea() * constants.KEARTH_CIRCUMFERENCE_METERS;
            covering_area += cell_area;
            logger.log(JSON.stringify(cell.toGEOJSON()) + ",");
        });
        */
        //logger.log("no. of cells in region = " + counter + "-> area = " + covering_area);
        return results;
    }

    /**
     * divide the bigger cell into child cells of index 0...3
     * @param next_cell_id
     * @returns {Array}
     */
    S2CircleCoverer.divide = function (next_cell_id) {

        var level = next_cell_id.level(); //e.g. 10
        var divided_cell_id;
        var divided_cell;
        var children = new Array(4);
        for (var i = 0; i < 4; i++) {
            divided_cell_id = next_cell_id.child(i);
            divided_cell = new s2.S2Cell(divided_cell_id);
            children.push(divided_cell);
        }
        //var divided_cell = new s2.S2Cell(divided_cell_id);
        //var size = divided_cell.approxArea() * kEarthCircumferenceMeters;
        return children;
    }

    S2CircleCoverer.initialise = function (lat, lon, radius,cb) {
        var min = constants.S2_CELL_MIN_LEVEL;
        var max = constants.S2_CELL_MAX_LEVEL;
        var max_cells = constants.DEFAULT_CITY_MAX_CELLS;
        var city_grid = this.getCovering(lat, lon, radius, min, max, max_cells);
        //add code to check if redis is connected and ready?
        city_grid.forEach(function (city_cell) {
            //var city_s2cell = new s2.S2Cell(city_cell)
            //var area = (city_s2cell.approxArea() * 1000000 * 1000 * 40075.017).toFixed(0);
            redis.createCellPosition(city_cell.id);
        });
        cb(city_grid);
    }

    return S2CircleCoverer;
}).call(this);

exports.S2CircleCoverer = S2CircleCoverer;

//S2CircleCoverer.initialise(0, 0, 100);
