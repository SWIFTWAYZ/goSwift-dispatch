/**
 * Created by tinyiko on 2017/04/03.
 */

var nodes2ts = require("nodes2ts");
var redis = require("../redis/redisProvider");
var init = require("../config/init");
var _ = require('underscore');
var s2circle = require("../s2geometry/s2circlecoverer");

function logRiderLocation(lat,lon,rider_UUID,mobile_number){
    var s2Latlong = new s2.S2LatLng(lat,lon);
    var s2riderCellId = new s2.S2CellId(s2Latlong);

    var driver_data = {
        key: s2riderCellId.id(),
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

function arrayCopy(oldArray){
    return JSON.parse(JSON.stringify(oldArray))
}

(function(){

    var triprequest = {};


    /**
     * retrieve cells in customer rectangle that intersect with city-grid
     * @param rect
     */
    triprequest.getIntersectSquareCells = function(rect){
        redis.redisService.getCityGrid().then(function(data,reject) {

            //-26.115461, 28.092047
            //-26.135891, 28.117186

            //var hi = new nodes2ts.S2LatLng.fromDegrees(-26.115461, 28.092047);

            var lo = new nodes2ts.S2LatLng.fromDegrees(-26.135891, 28.117186);
            var hi2 = new nodes2ts.S2LatLng.fromDegrees(-26.129719, 28.131236);
            //-26.135891, 28.117186
            //-26.129719, 28.131236
            var riderSquare = nodes2ts.S2LatLngRect.fromLatLng(lo, hi2);

            //-26.135891, 28.117186 (Edenvale - city centre)
            var cityRegion = new nodes2ts.S2CellUnion(parseFloat(init.city.lat),parseFloat(init.city.lon));
            cityRegion.initFromIds(data);
            cityRegion.normalize();

            var riderSquare = s2circle.S2CircleCoverer.getSquareCovering(riderSquare, 12, 20, 100);
            var riderRegion2 = new nodes2ts.S2CellUnion();
            riderRegion2.initRawCellIds(riderSquare);
            riderRegion2.normalize();

            var intersect_union = new nodes2ts.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion2); //Google S2 bug fixed
            console.log ("total number of city grids = " + intersect_union.size());

            //riderSquare.fromLatLng(hi,lo);
        });
    }
    /**
     * retrieve cells from city grid cells that intersect customer circle
     * @param cust_scap
     */
    triprequest.getIntersectRadiusCells = function(lat,lon,radius){
        redis.redisService.getCityGrid().then(function(data,reject){

            var riderSphere = s2circle.S2CircleCoverer.getCovering(lat,lon,radius,12,26,100);

            var cityRegion = new nodes2ts.S2CellUnion(-26.135891, 28.117186);
            cityRegion.initFromIds(data);
            cityRegion.normalize();

            var riderRegion = new nodes2ts.S2CellUnion();
            riderRegion.initRawCellIds(riderSphere);
            riderRegion.normalize();

            console.log("rider square = "+"-"+riderRegion.size());
            //console.log ("total number of cityRegion = " + cityRegion.size() +", -length riderRegion = " + riderRegion.size());

            var intersect_union = new nodes2ts.S2CellUnion();
            var union = intersect_union.getIntersectionUU(cityRegion,riderRegion); //Google S2 bug fixed
            console.log ("total number of city grids = " + intersect_union.size());

        });

    }
    exports.triprequest = triprequest;

    /***
     * testing ......
     */

    //triprequest.getIntersectCityCells(-26.104628,28.053901);
    //triprequest.getIntersectCityCells(-26.270155, 28.438425); //spring
    //triprequest.getIntersectCityCells(-26.152353, 28.255995);
    //triprequest.getIntersectCityCells(-25.86464683750316,27.877844426113754);

    //for(var i = 0; i < 2; i++) {
        triprequest.getIntersectRadiusCells(-26.217146, 28.356669,2680);
        //triprequest.getIntersectSquareCells(null)
    //}
    //-26.270155, 28.438425 (Spring - outside)
    //-26.152353, 28.255995 (boksburg - outside)
    //27.877844426113754,-25.86464683750316 (outside edge cells)
    //-26.240749, 28.376074
    //-26.217146, 28.356669 //near the edge

}).call(this)