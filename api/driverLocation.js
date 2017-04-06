/**
 * Created by tinyiko on 2017/04/03.
 */
var promise = require("bluebird");
var s2 = require("s2geometry-node");
var express = require("express");
var redisService = require("../redis/redisProvider");
var mst = require("../algorithms/minimumSpanningTree");

var driver_hashset = "DRIVERS_HSET";
var riders_hashset = "RIDERS_HSET";

var earth_radius = 1000 * 6378.1; // (km = 6378.1) - radius of the earth
var default_dispatch_radius = 31885;    //meters
var kEarthCircumferenceMeters = 1000 * 40075.017;
var default_s2cell_level = 12;
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
    var s2Latlong = new s2.S2LatLng(lat,lon);
    var s2driverCellId = new s2.S2CellId(s2Latlong);
    //var s2driverCellId = s2driverCell.id();
    var parent_key = getParentCellAtlevel(s2driverCellId,15);

    var driver_data = {
        key: s2driverCellId.id(),
        lat:lat,
        lon:lon,
        parent_level: parent_key.level(),
        parent_key: parent_key.id(),
        date_time: new Date(),
        driver_uuid: driver_UUID,
        driver_mobile: mobile_number,
        //s2cell_id:s2driverCellId.id() //initialize to cell_id of earth
    };

    //console.log("log vehicle with ID=" + JSON.stringify(driver_data));
    console.log(s2driverCellId.id() + "->level = " + s2driverCellId.level());
    console.log(decimalToBinary(s2driverCellId.id()));

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
    console.log("typeof->"+typeof(s2cell));
    var s2Parent = s2cell.parent(parent_level);
    console.log("Parent id="+ s2Parent.id() + "->level = " + parent_level);
    console.log("binary key ->"+decimalToBinary(s2Parent.id()));
    return s2Parent;
}

function EarthMetersToRadians(meters) {
  return (2 * Math.PI) * (meters / kEarthCircumferenceMeters);
}

/**
 * list drivers within radius of customer centrepoint
 * @param cust_latlng
 * @param radius
 */
function listDriversInRadius(cust_latlng,radius){
    var cap = getS2CapAtLatLng(cust_latlng,radius);
    var gps_customer = {latitude:-26.166329,longitude:28.148618};

    mst.readDrivers(function(data){
        data.forEach(function(each_driver){
            //console.log("each driver->"+JSON.stringify(each_driver));
            var gps_driver = {
                latitude:each_driver.latitude,
                longitude:each_driver.longitude
            };
            var distance = mst.getDist(gps_driver,gps_customer,2)*1000;
            lat = parseFloat(each_driver.latitude);
            lon = parseFloat(each_driver.longitude);

            var driver_s2latlng = new s2.S2LatLng(lat,lon);
            var driver_s2cellid = new s2.S2CellId(driver_s2latlng);
            var driver = getS2CapAtLatLng(driver_s2latlng,0);

            if(cap.contains(driver)) {
                redis.hsetAdd(redis.driver_hashset, driver_s2cellid.id());
                console.log("is driver within radius?=" + radius +"->"+
                    cap.contains(driver) + "=distance="+distance);
            }
        })

    });

    var keys = redis.keys(function(data){
        console.log(data + "length = " + data.length);
    });

}

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
        console.log("radius ->" + axis_height + "\narea ->" + rect.size());
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
    //console.log("rangeMin - size of cell =" + s2cell.min());

    console.log("size of cell at level ->" + level + "=" + size);
    return size;
    //approxArea
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

//logDriverLocation(35.669396,139.696042,"00002345","0847849574");
var s2latlng = new s2.S2LatLng(-26.166329,28.148618);
listDriversInRadius(s2latlng,13000);
//calcS2CapSize(null,3);

