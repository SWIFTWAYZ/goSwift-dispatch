/**
 * Created by tinyiko on 2017/04/03.
 */
var promise = require("bluebird");
var s2 = require("nodes2ts");
var express = require("express");
var redisService = require("../redis/redisProvider");
var mst = require("../algorithms/minimumSpanningTree");
var swift = require("../constants");

/*const driver_hashset = "DRIVERS_HSET";
const riders_hashset = "RIDERS_HSET";*/

const earth_radius = 1000 * 6378.1; // (km = 6378.1) - radius of the earth
const default_dispatch_radius = 31885;    //meters
const kEarthCircumferenceMeters = 1000 * 40075.017;
const default_cell_resolution = 12; /* 3km2 - 6km2*/
var redis = redisService.redisService;

/**
 * log all GPS data from drivers
 * @param lat
 * @param lon
 * @param driver_UUID
 * @param mobile_number
 */
function logDriverLocation(lat,lon,driver_UUID,mobile_number){
      if (isNaN(lat) || isNaN(lon)) {
            throw new Error('Invalid LatLng object: (' + lat + ', ' + lon + ')');
     }
    var s2Latlong = new s2.S2LatLng.fromDegrees(lat,lon);
    console.log("s2latlng = " + s2Latlong);

    var s2driverCellId = new s2.S2CellId.fromPoint(s2Latlong.toPoint());
    //var s2driverCellId = s2driverCell.id();
    var key = s2driverCellId.id+""; //2203687589641513315 -- {"low":-393942685,"high":513085999,"unsigned":false}
    var parent_key = getParentCellAtlevel(s2driverCellId,15);

    var driver_data = {
        key: key,
        lat:lat,
        lon:lon,
        parent_level: parent_key.level(),
        parent_key: parent_key.id+"",
        date_time: new Date(),
        driver_uuid: driver_UUID,
        driver_mobile: mobile_number,
        //s2cell_id:s2driverCellId.id() //initialize to cell_id of earth
    };

    console.log("log vehicle with ID=" + JSON.stringify(driver_data));
    console.log(s2driverCellId.id + "->level = " + s2driverCellId.level());
    console.log(decimalToBinary(s2driverCellId.id));

    getS2CellArea(s2driverCellId,12);
    calcS2CapSize(s2Latlong,21000);
}

/**
 * given a leaf cell and a level, return its parent at that level
 * @param s2cell
 * @param parent_level
 * @returns {null}
 */
function getParentCellAtlevel(s2cell, parent_level){
    if (isNaN(parent_level) || parent_level < 1 || parent_level > 30) {
    throw new Error("'level' not valid, must be a number between 1 and 30");
  }
    console.log("typeof->"+s2cell.pos());
    var s2Parent = s2cell.parentL(parent_level);
    console.log("Parent id="+ s2Parent.id + "->level = " + parent_level);
    console.log("binary key ->"+decimalToBinary(s2Parent.id));
    return s2Parent;
}

function EarthMetersToRadians(meters) {
  return (2 * Math.PI) * (meters / kEarthCircumferenceMeters);
}

/**
 * function to convert latlng degrees into S2CellId and store in redis.
 * Retrieve the s2 cell that this driver GPS location belongs to
 * @param user_id
 * @param mobile
 * @param lat
 * @param lon
 */
function logDriverGPSLocation(user_id,mobile,lat,lon){
    var s2_cellid = swift.s2CellIDfromLatLng(lat,lon);
    console.log("s2_cellid = " + s2_cellid.id.toString());
    //retrieve city cell that this driver belongs to
    var parent_level12 = s2_cellid.parent(12);
    console.log("parent_12 = " + parent_level12.id.toString());
    //sismember key member
    //redis.isMember();

}

function addDrivers(){
    mst.readDrivers(function(data){
        data.forEach(function(each_driver) {
            //console.log("each driver->"+JSON.stringify(each_driver));

            lat = each_driver.latitude;
            lon = each_driver.longitude;
            var driver_s2latlng = new s2.S2LatLng(lat,lon);
            var driver_s2cellid = new s2.S2CellId(driver_s2latlng);

            //redis.createCellPosition(driver_s2cellid);
            //var cell_pos = getCellPosition()

            //redis.addDriverPosition(cell_pos,driver_s2cellid)

            redis.addDriverPosition(redis.driver_hashset,driver_s2cellid);
        });
    });
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
                cap.contains(driver) + "=distance=" + distance);
        }
    });
}

var keys = redis.keys(function(data){
        if(data != null) {
            console.log(data + "length = " + data.length);
        }
});

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
function calcS2CapSize(latLng,radius_meters){
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
function getS2CellArea(s2cell,level){
    var cell_id = getParentCellAtlevel(s2cell,level);
    var s2cell = new s2.S2Cell(cell_id);
    var size = s2cell.approxArea();
    console.log("size of cell at level ->" + level + "=" + size);
    return size;
}

function decimalToBinary(DecimalValue){
		var BinaryValue = '';
		// Loop from 2^64/2 to 1
		for (var i=64; i>=1; i--){
			// Is 2^i/2 within DecimalValue?
			if(DecimalValue >= Math.pow(2,i)/2){
				// If so, add a 1 to BinaryValue and subtract 2^i/2 from DecimalValue
				BinaryValue = BinaryValue+'1';
				DecimalValue = DecimalValue - (Math.pow(2,i)/2);
			}
			else if(BinaryValue.indexOf("1") != -1){
				// If not, add a 0, but only if there is already a 1 in the value
				BinaryValue = BinaryValue+'0';
			}
		}
		return BinaryValue;
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
logDriverGPSLocation("tin2yiko",'0847849574',-26.0309030,28.040768);

var s2latlng = new s2.S2LatLng(-26.166329,28.148618);

var radius_rect = calcS2CapSize(s2latlng,18000);
console.log("size of rect " + radius_rect.size + radius_rect.getVertex(0));
console.log("size of rect " + radius_rect.getVertex(1));
console.log("size of rect " + radius_rect.getVertex(2));
console.log("size of rect " + radius_rect.getVertex(3));

