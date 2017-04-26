/**
 * Created by tinyiko on 2017/04/03.
 */

var s2 = require("nodes2ts");
var redis = require("../redis/redisProvider");
var init = require("../config/init");
var _ = require('underscore');
var constant = require('../constants');
var s2circle = require("../s2geometry/s2circlecoverer");

function logRiderLocation(lat,lon,rider_UUID,mobile_number){
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

function deepCopy (arr) {
    var out = [];
    for (var i = 0, len = arr.length; i < len; i++) {
        var item = arr[i];
        var obj = {};
        for (var k in item) {
            obj[k] = item[k];
        }
        out.push(obj);
    }
    return out;
}

function arrayClone( arr ) {
    if( _.isArray( arr ) ) {
        return _.map( arr, arrayClone );
    } else if( typeof arr === 'object' ) {
        throw 'Cannot clone array containing an object!';
    } else {
        return arr;
    }
}

(function(){

    var triprequest = {};

    /**
     * retrieve cells in customer rectangle that intersect with city-grid
     * @param rect
     */
    //getRiderGeoSquare
    triprequest.getIntersectSquareCells = function(rect){
        redis.redisService.getCityGrid().then(function(data,reject) {

            var lo = new s2.S2LatLng.fromDegrees(-26.135891, 28.117186);
            var hi = new s2.S2LatLng.fromDegrees(-26.129719, 28.131236);

            var riderSquare = s2.S2LatLngRect.fromLatLng(lo, hi);

            console.log("city lat_lon = " + init.city.lat+","+init.city.lon);
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();
            var riderSquare = s2circle.S2CircleCoverer.getSquareCovering(riderSquare, 12, 20, 100);
            var riderRegion2 = new s2.S2CellUnion();
            riderRegion2.initRawCellIds(riderSquare);
            riderRegion2.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion2); //Google S2 bug fixed
            console.log ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion2.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");
        });
    }
    /**
     * retrieve cells from city grid cells that intersect customer circle
     * @param cust_scap
     */

    //getRiderGeoRadius
    triprequest.getIntersectRadiusCells = function(lat,lon,radius){
        redis.redisService.getCityGrid().then(function(data,reject){
            var min = constant.S2_CELL_MIN_LEVEL;
            var max = constant.S2_CELL_MAX_LEVEL;
            var no_of_cells = constant.DEFAULT_RIDER_MAX_CELLS;

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,min,max,no_of_cells);
            console.log("city lat_lon = " + init.city.lat+","+init.city.lon);
            var cityRegion = new s2.S2CellUnion(init.city.lat,init.city.lon);
            cityRegion.initFromIds(data);
            cityRegion.normalize();

            var riderRegion = new s2.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            var intersect_union = new s2.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed

            console.log ("city cells = " + cityRegion.size() + ", rider cells = " + riderRegion.size() +
                " - [intersecting cells = " + intersect_union.size() + "]");
        });
    }
    exports.triprequest = triprequest;

    /***
     * testing ......
     */

    triprequest.getIntersectRadiusCells(-26.217146, 28.356669,constant.RIDER_GEO_RADIUS);

    //-26.270155, 28.438425 (Spring - outside)
    //-26.152353, 28.255995 (boksburg - outside)
    //27.877844426113754,-25.86464683750316 (outside edge cells)
    //-26.240749, 28.376074
    //-26.217146, 28.356669 //near the edge

}).call(this)