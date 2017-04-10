/**
 * Created by tinyiko on 2017/04/03.
 */
var promise = require("bluebird");
var s2 = require("s2geometry-node");

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