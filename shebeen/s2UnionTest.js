/**
 * Created by tinyiko on 2017/04/12.
 */

var s2 = require("nodes2ts");

var cellId_one = "2203795067297071104,2203794792419164160";
//var cellId_one = "2203794929858117632";
//var cellId_one = "2203794792419164160";
//Tulbagh = 2203794929858117632
//Porche dealer = 2203795067297071104
//"2203840834468577280";
//"2203676182602317824,2203694187105222656," +
//"2203734542617935872,2203734645697150976,2203699392605585408";

var cellIds_two="2203795001640038161,2203794989626726499,2203795003930470261,"+
    "2203795004670293457,2203795004245194413,2203795027567883285,2203795025995072127";

function arrayCopy(oldArray){
    return JSON.parse(JSON.stringify(oldArray))
}

makeS2Union = function(){

    var unionOne = new s2.S2CellUnion();
    var cell_ids = cellId_one.split(',');
    console.log(cell_ids);
    unionOne.initFromIds(cell_ids);

    var unionTwo = new s2.S2CellUnion();
    var cell_ids2 = cellIds_two.split(',');
    console.log(cell_ids2);
    unionTwo.initFromIds(cell_ids2);

    var newUnion = new s2.S2CellUnion();
    newUnion.getUnion(unionOne,unionTwo);

    var rangeMax = unionOne.cellId(0).rangeMax();
    console.log("new union-1 = " + unionOne.size());

    /*unionTwo.getCellIds().forEach(function(cell){
        var c = new s2.S2Cell(cell);
        console.log(JSON.stringify(c.toGEOJSON()) + "");
    });*/

    var intersection = new s2.S2CellUnion();
    console.log(intersection.size());

    intersection.getIntersectionUU(unionOne,unionTwo);

    console.log("intersecting cells = " + intersection.size());
    if(intersection.size() > 0 ) {
        var cells = intersection.getCellIds();
        for(var i = 0; i < cells.length; i++ )
        {
            var intersect_cellid = intersection.getCellIds()[i].id.toString();
            var cellid = new s2.S2CellId(intersect_cellid);

            var s2_cell = new s2.S2Cell(cellid);
            //console.log(JSON.stringify(s2_cell.toGEOJSON()) + "");
            console.log(cellid.toLatLng().toStringDegrees());
        }
    }
}

makeS2Union();