/**
 * Created by tinyiko on 2017/04/23.
 */

var lineReader = require('line-reader');
var Promise = require("bluebird");
var s2 = require("nodes2ts");
var constants = require("../constants");

var line_counter = 0;
var unreached = [];
var gpsPoint = function(lat,lon,isDepart,name){
    this.latitude = lat;
    this.longitude = lon;
    this.isDepart = isDepart;
    this.name = name;
    this.distance = 0;

}

function toRad(degrees){
    var radians = degrees * Math.PI/180;
    return radians;
}

if(typeof(Number.prototype.toRad) === "undefined") {
    Number.prototype.toRad = function () {
        return this * Math.PI / 180;
    }
}

function EarthMetersToRadians(meters) {
    return (2 * Math.PI) * (meters /constants.KEARTH_CIRCUMFERENCE_METERS);
}

var distanceCalc = function(start, end, decimals){
    decimals = decimals || 2;
    var earthRadius = 6371; // km
    //console.log("GPS=latitude distanceCalc = " + start + "|" + end);
    lat1 = parseFloat(start.latitude);
    lat2 = parseFloat(end.latitude);
    var lon1 = parseFloat(start.longitude);
    var lon2 = parseFloat(end.longitude);

    var dLat = (lat2 - lat1).toRad();
    var dLon = (lon2 - lon1).toRad();
    var lat1 = lat1.toRad();
    var lat2 = lat2.toRad();

    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = earthRadius * c;
    //Math.round(d,6);
    return Math.round(d * Math.pow(10, decimals)) / Math.pow(10, decimals);

}

/**
 * Method to read each line in file and convert into GPS Point object (lat,lon)
 * @param resolve
 * @param reject
 * @returns {a promise}
 */
var readDrivers = function() {
    var readLine = Promise.promisify(lineReader.eachLine);
    var promise = new Promise(function(resolve,reject){
        readLine('/Users/tinyiko/WebstormProjects/GoSwift/server/config/seeds/Gps_dump2.csv', function (line, last) {
            var line_str = line.split(",");
            unreached[line_counter] = new gpsPoint(line_str[0], line_str[1], line_str[2], line_str[3]);
            //reached.push(unreached[line_counter]);
            line_counter++;
            //console.log("line counter = " + line_counter);
            if (last) {
                // or check if it's the last one
                console.log("last item = " + last + "=" + line_counter);
            }
        }).then(function(){
            resolve(unreached);
        });
    });
    return promise;
}

/**
 * retrieve array of parent IDs at level 12 - 14 for given leaf-id, where start-index
 * is the minimum level and no_of_levels is quantity of levels to maximum level
 * @param leaf_id
 * @param start_index
 * @param no_of_levels
 * @returns {null}
 */

var getParentIdArray = function(leaf_id, start_index, no_of_levels){
    var s2cell = new s2.S2CellId(leaf_id);
    var parentCellsArray = new Array();
    if(s2cell.isLeaf()){
        var total = start_index + no_of_levels;
        for(var i = start_index; i < total; i++){
            var parent12 = s2cell.parentL(i);
            parentCellsArray.push(parent12);
        }
    }
    return parentCellsArray;
}

/**
 * Get s2_cell_id for the given level, this method similar to driverLocation's
 * getParentCellAtLevel
 * @param cell_id
 * @param level
 */

//method similar to driverLocation->getParentCellAtlevel();
var getS2CellIdAtLevel = function(cell_id, level){
        if(isNaN(cell_id) || isNaN(level) || (level > 30 || level < 1)){
            throw new Error("cell_id must be a long integer, level should be between 1 - 30");
        }
        var s2cell_id = new s2.S2CellId(cell_id);
        var parent = s2cell_id.parentL(level);
        return parent;
};

/**
 * get 4 children (quad-cells) from a given cell-id that is not a leaf
 * @param cell_id
 * @returns {Array}
 */
var getChildrenCellIds = function(cell_id){
    if(isNaN(cell_id)){
        throw new Error("key must be an integer/string literal e.g.'2203794985692692496'");
    }
    var s2cell_id = new s2.S2CellId(cell_id);
    var array = new Array();
    if(s2cell_id.isLeaf() == false) {
        var s2cell = new s2.S2Cell(s2cell_id);

        var minR = s2cell_id.rangeMin();
        var maxR = s2cell_id.rangeMax();
        console.log("range of cell = " + s2cell.id.pos() + ">min = " + minR.id + ">max="+maxR.id);

        var s2_children = s2cell.subdivide();
        for (var i = 0; i < 4; i++) {
            var child = s2_children[i];
            var key = child.id;
            array.push(key.pos());
            console.log(child.id + "-quadkey = " + key.pos()+"");
        }
    }
    else{
        throw new Error("Cell should not be a leaf node. (id = "+cell_id+")");
    }
    return array;
}


function getFirstLeafCellOfBranch (parent){
    if(parent.isLeaf() == true) return;
    //var s2cell_centre = null;
    while(i < 18){
        s2cell_centre = parent.subdivide()[0];
        console.log(s2cell_centre + "=" + s2cell_centre.id.id +"="+i);
        i++;
        getFirstLeafCellOfBranch(s2cell_centre);
    }
}

function getLastLeafCellOfBranch(parent){
    if(parent.isLeaf() == true) return;
    while(count < 18){
        var s2cell_centre = parent.subdivide()[3];
        console.log(s2cell_centre + "=" + s2cell_centre.id.id +"="+count);
        count++;
        getLastLeafCellOfBranch(s2cell_centre);
    }
}
//calculate cell-id range for leaf cells contained in a particular cell
//get minimum leaf-cell id (level 30) from quad tree (level 14)c
function getLeafCellMinRange(cell_id){
    var s2cell = new s2.S2CellId(cell_id);
        if(s2cell.isValid()){
            var start_id = s2cell.parentL(12);
            console.log("start child at level 12 = "+s2cell + " ="+start_id);
            return start_id;
        }
}

function getLeafCellMaxRange(cell_id){
    var s2cell = new s2.S2CellId(cell_id);
    if(s2cell.isValid()){
        var s2cell_level29 = s2cell.parentL(29);
        var end_id = s2cell_level29.childEnd();
        console.log("end child at level 29 = "+s2cell_level29.id + " ="+end_id.id);
        return end_id;
    }
}

/**
 * Returns a position of the cell center along the Hilbert curve
 * from given two latitude and longitude doubles
 * @param lat
 * @param lon
 * @returns {string}
 */
function s2CellIDfromLatLng(lat,lon){
    if(isNaN(lat) || isNaN(lon)){
        throw new Error("latitude and longitude must be double values");
    }
    var s2_latlng = new s2.S2LatLng.fromDegrees(lat,lon);
    var s2_point = s2_latlng.toPoint();
    var s2_cellid = new s2.S2CellId.fromPoint(s2_point);

    return s2_cellid;
}

function s2CellIdKeyFromLatLng(lat,lon){
    return s2CellIDfromLatLng(lat,lon).pos().toString();
}
/**
 * Returns a S2Cell object from a latlng
 * @param lat
 * @param lon
 * @returns {S2Cell}
 */
function s2CellfromLatLng(lat,lon){
    if(isNaN(lat) || isNaN(lon)){
        throw new Error("latitude and longitude must be double values");
    }
    var s2_latlng = s2.S2LatLng.fromDegrees(lat,lon);
    var s2cell = new s2.S2Cell.fromLatLng(s2_latlng);
    return s2cell;
}

/**
 * given a level and leaf id, this function returns id of parent
 * @param level
 * @param leaf_id
 */
function getParentIdAtLevel(level,leaf_id){
    if(level < 30 && level > 1) {
        var s2cell = new s2.S2CellId(leaf_id);
        var parent_s2cell = s2cell.parentL(level);
        return parent_s2cell.id.toString();
    }
    else{
        throw new Error("Out of bounds error (level must be between 1 and 30)")
    }
}

/***
 * Method returns an intersection set for two cellId Arrays
 * @param s2cellIds_A
 * @param s2cellIds_B
 * @returns {S2CellUnion}
 */
function getCellIntersection(cellIdArray_A, cellIdArray_B){
    //var intersectArray = new Array();
    var unionOne = new s2.S2CellUnion();
    var unionTwo = new s2.S2CellUnion();
    var intersection = new s2.S2CellUnion();

    if(cellIdArray_A.length > 0 && cellIdArray_B.length > 0){

        unionOne.initFromIds(cellIdArray_A);
        unionTwo.initFromIds(cellIdArray_B);
        intersection.getIntersectionUU(unionOne,unionTwo);

        var cells = intersection.getCellIds();
    }
    return cells;
    //return intersectArray;
}

/***
 * Test method that reads cellIds from file
 */

function addDriversFromFile(){
    //2203792181079048192 - 3//2203794929858117632 - 3 intersects
    //2203795067297071104 - 13//2203792318518001664 - 1

    var sandton_near = new s2.S2CellId("2203792318518001664").getEdgeNeighbors();
    console.log("edge neighbors = "+sandton_near);

    var sandton = new s2.S2CellId.fromToken("1e95715000000000");
    console.log("cell-id from token = " + sandton.id);
    readDrivers().then(function(data){
        data.forEach(function(each_driver) {
            lat = each_driver.latitude;
            lon = each_driver.longitude;
            var s2cell_id = s2CellIDfromLatLng(lat,lon);
            console.log("cell_id = " + s2cell_id.id + "["+lat+","+lon + "]="+sandton.contains(s2cell_id));

        });
    }).catch(function(error){
        console.log(error);
    });
}

var cellIds_one = "2203794792419164160,2203795067297071104";
var cellIds_two = "2203795001640038161,2203794989626726499,2203795003930470261,2203795004670293457," +
                  "2203795004245194413,2203795027567883285,2203795025995072127";

var array_one = cellIds_one.split(',');
var array_two = cellIds_two.split(',');
var results = getCellIntersection(array_one,array_two);

console.log("intersecting cells = " + results.length);
results.forEach(function(item) {
        console.log("Intersect:-"+item.id + "-"+item.toLatLng().toStringDegrees());
});


/*getLeafCellMinRange("2203794985692692485");
var key = s2CellIDfromLatLng(-26.217146, 28.356669);
console.log("key = " + key);

getChildrenCellIds("2203795067297071104");

var i = 0
var s2cell_id = new s2.S2CellId("2203795001640038161");
var s2cell = new s2.S2Cell(s2cell_id);
getFirstLeafCellOfBranch(s2cell);
console.log("--------------------");
var count = 0;
getLastLeafCellOfBranch(s2cell);*/

addDriversFromFile()

exports.getChildrenCellIds = getChildrenCellIds;
exports.getS2CellIdAtLevel = getS2CellIdAtLevel;
exports.getParentIdArray = getParentIdArray;

exports.toRad = toRad;
exports.s2CellIDfromLatLng = s2CellIDfromLatLng;
exports.s2CellfromLatLng = s2CellfromLatLng;
exports.getParentIdAtLevel = getParentIdAtLevel;
exports.distanceCalc = distanceCalc;
exports.readDrivers = readDrivers;
exports.EarthMetersToRadians = EarthMetersToRadians;
exports.s2CellIdKeyFromLatLng = s2CellIdKeyFromLatLng;
