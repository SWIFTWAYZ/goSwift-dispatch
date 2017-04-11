/**
 * Created by tinyiko on 2017/04/03.
 */
var promise = require("bluebird");
var s2 = require("s2geometry-node");
var nodes2ts = require("nodes2ts");
var redis = require("../redis/redisProvider");
var s2circle = require("../s2geometry/s2circlecoverer");

var riders_hashset = "RIDERS_HSET";

function logRiderLocation(lat,lon,rider_UUID,mobile_number){
    var s2Latlong = new s2.S2LatLng(lat,lon);
    var s2riderCellId = new s2.S2CellId(s2Latlong);
    //var s2driverCellId = s2driverCell.id();

    var driver_data = {
        key: s2riderCellId.id(),
        lat:lat,
        lon:lon,
        date_time: new Date(),
        driver_uuid: rider_UUID,
        driver_mobile: mobile_number,
        //s2cell_id:s2driverCellId.id() //initialize to cell_id of earth
    };
}

(function(){

    var triprequest = {};

    /**
     * retrieve cells from city grid cells that intersect customer latlng
     * @param cust_scap
     */
    triprequest.getIntersectCityCells = function(lat,lon){
        //:nodes2ts.S2Cap
        var cust_latlon = new nodes2ts.S2LatLng.fromDegrees(lat,lon);
        var cust_scap = s2circle.getS2CapRadius(cust_latlon,0);
        var city_cells = redis.redisService.getCityGrid(function(data){
            console.log ("total number of city grids = " + data);
        });
    }
    exports.triprequest = triprequest;

    /***
     * testing ......
     */

    triprequest.getIntersectCityCells(-26.104628,28.053901);

}).call(this)