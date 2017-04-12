/**
 * Created by tinyiko on 2017/04/03.
 */

var s2 = require("s2geometry-node");
var nodes2ts = require("nodes2ts");
var redis = require("../redis/redisProvider");
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
     * retrieve cells from city grid cells that intersect customer latlng
     * @param cust_scap
     */
    triprequest.getIntersectCityCells = function(lat,lon){
        //:nodes2ts.S2Cap

        redis.redisService.getCityGrid().then(function(data,reject){

            var gridRegion = new nodes2ts.S2CellUnion();
            gridRegion.initFromIds(data);
            gridRegion.normalize();

            var gridRegion2 = new nodes2ts.S2CellUnion();

            var copy = arrayCopy(data.splice(7,4));
            console.log("deep copy into gridRegion2 = " + copy);
            gridRegion2.initFromIds(copy);
            gridRegion2.normalize();

            console.log("cust_covering = "+ gridRegion2);
            var gridRegion3 = new nodes2ts.S2CellUnion();
            var copy2 = arrayCopy(data.splice(15,6))
            console.log("deep copy into gridRegion3= " + copy2);
            gridRegion3.initFromIds(copy2);
            gridRegion3.normalize();

            console.log ("total number of gridRegion3 = " + gridRegion3.size() +", -length gridRegion2=" + gridRegion2.size());
            console.log("gridRegion3="+gridRegion3.cellId(4).rangeMin() + "-gridRegion2=" + gridRegion2.cellId(3).rangeMin());

            var new_union = new nodes2ts.S2CellUnion();
            var union = new_union.getIntersectionUU(gridRegion3,gridRegion2); //errors here
            console.log ("total number of city grids = " + union);

            //check the vertices of cust_scap and then check which of the level 12 cells
            //contains the edges. retrieve those cells's vehicles cell_ids and then
            //check if their id's are bounded by the cap
        });

    }
    exports.triprequest = triprequest;

    /***
     * testing ......
     */

    triprequest.getIntersectCityCells(-26.104628,28.053901);

}).call(this)