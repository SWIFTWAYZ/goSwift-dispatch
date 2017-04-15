/**
 * Created by tinyiko on 2017/04/15.
 */
var s2 = require("nodes2ts");

const S2_CELL_BIG_SUBURB_LEVEL = 12; //5541846 sqm (5.5 km2)
const S2_CELL_SMALL_SUBURB_LEVEL = 13; //1386091 sqm (1.3 km2)
const S2_CELL_BIG_MALL_LEVEL = 14;  //346697 sqm
const S2_CELL_BLOCK_LEVEL = 17; //5417 sqm
const S2_CELL_HOUSE_LEVEL = 18; //1377 sqm

function toRad(degrees){
    var radians = degrees * Math.PI/180;
    return radians;
}

function s2CellIDfromLatLng(lat,lon){
    var s2_latlng = new s2.S2LatLng.fromDegrees(lat,lon);
    var s2_point = s2_latlng.toPoint();
    var s2_cellid = new s2.S2CellId.fromPoint(s2_point);

    return s2_cellid;
}

function s2CellfromLatLng(lat,lon){
    var s2_cellid = s2CellIDfromLatLng(lat,lon);
    var s2cell = new s2.S2Cell.fromPoint(s2_cellid.toPoint());
    return s2cell;
}

function getQuadIdFromLatLng(lat,lon){
    var id = s2CellfromLatLng(lat,lon).id.id.toString();
    return id;
}

exports.S2_CELL_BIG_SUBURB_LEVEL = S2_CELL_BIG_SUBURB_LEVEL;
exports.toRad = toRad;
exports.s2CellIDfromLatLng = s2CellIDfromLatLng;
exports.s2CellfromLatLng = s2CellfromLatLng;
exports.getQuadIdFromLatLng = getQuadIdFromLatLng;

//console.log(s2CellfromLatLng(-26.0309030,28.040768).id.id.toString()+"");
console.log(getQuadIdFromLatLng(-26.0309030,28.040768));