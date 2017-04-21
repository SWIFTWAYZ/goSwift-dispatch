/**
 * Created by tinyiko on 2017/04/15.
 */
var s2 = require("nodes2ts");

const S2_CELL_BIG_SUBURB_LEVEL = 12; //5541846 sqm (5.5 km2)
const S2_CELL_SMALL_SUBURB_LEVEL = 13; //1386091 sqm (1.3 km2)
const S2_CELL_BIG_MALL_LEVEL = 14;  //346697 sqm
const S2_CELL_BLOCK_LEVEL = 17; //5417 sqm
const S2_CELL_HOUSE_LEVEL = 18; //1377 sqm
const DEFAULT_MAX_CELLS = 1000;

const RIDER_GEO_RADIUS = 2680;

function toRad(degrees){
    var radians = degrees * Math.PI/180;
    return radians;
}

/**
 * returns a S2CellId from a latlng
 * @param lat
 * @param lon
 * @returns {s2.S2CellId.fromPoint}
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
 * get a hilbert curve key/id from a latlng
 * @param lat
 * @param lon
 * @returns {string}
 */
function getQuadIdFromLatLng(lat,lon){
    var id = s2CellIDfromLatLng(lat,lon).id+"";
    return id;
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

exports.S2_CELL_BIG_SUBURB_LEVEL = S2_CELL_BIG_SUBURB_LEVEL;
exports.DEFAULT_MAX_CELLS = DEFAULT_MAX_CELLS;
exports.RIDER_GEO_RADIUS = RIDER_GEO_RADIUS;

exports.toRad = toRad;
exports.s2CellIDfromLatLng = s2CellIDfromLatLng;
exports.s2CellfromLatLng = s2CellfromLatLng;
exports.getQuadIdFromLatLng = getQuadIdFromLatLng;
exports.getParentIdAtLevel = getParentIdAtLevel;

//console.log(getParentIdAtLevel(12,"2203795019799751829"));

console.log(s2CellIDfromLatLng(-26.0309030,28.040768).id.toString());
console.log(s2CellfromLatLng(-26.0309030,28.040768).id.id.toString()+"");
console.log(getQuadIdFromLatLng(-26.0309030,28.040768));
//2203795001640038161
//console.log(getS2CellLevel(s2CellfromLatLng(-26.0309030,28.040768)));


//console.log(getParentIdAtLevel(12,"2203795019799751829"));
/*console.log(getParentIdAtLevel(13,"2203795019799751829"));
console.log(getParentIdAtLevel(14,"2203795019799751829"));

console.log("from token = " + s2.S2CellId.fromToken("1e9573d").pos());
console.log("from token = " + s2.S2CellId.fromToken("1e9573e0b6892f11").pos());*/
