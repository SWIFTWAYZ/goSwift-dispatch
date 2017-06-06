/**
 * Created by tinyiko on 2017/06/04.
 */
var redis = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger
var builder = require("xmlbuilder");

var xmlBuilderFactory = (function(){

    /**
     * factory function to build an XMl DOM model with cellArray and
     * GPS track points
     */
    function xmlBuilderFactory(){};

    /**
     * builds XML DOM for cell polygons representing s2cells
     * @param document_name
     * @param cellArray
     */
    xmlBuilderFactory.buildCells = function(document_name,cellArray,cellArray2,color_code,width){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up()
            .ele("Style").att("id","default")
            .ele("LineStyle")
            .ele("color",color_code).up()
            .ele("width",width)
            .up().up().up()
            .ele("StyleMap").att("id","default0")
            .ele("Pair")
            .ele("key","normal").up()
            .ele("styleUrl","#default")
            .up().up().up();

        if(cellArray !== null) {
            cellArray.forEach(function (item) {

                var stringBuild = "";
                for (var i = 0; i < item.length; i++) {
                    stringBuild = stringBuild + item[i] + ",0 ";
                    if (i === 4) {
                        buildersList
                            .ele("Placemark")
                            .ele("styleUrl", "#default0").up()
                            .ele("LineString")
                            .ele("coordinates", stringBuild)
                    }
                }
                //logger.log(stringBuild);
            });
        }

        if(cellArray2 !== null) {
            cellArray2.forEach(function (item) {
                buildersList
                    .ele("Placemark")
                    .ele("Point")
                    .ele("coordinates", item)
            });
        }
        var xml = buildersList.end({pretty: true});
        console.log(xml);
    }

    /**
     * builds XML DOM for location GPS points of vehicles
     * @param document_name
     * @param cellArray
     */
     xmlBuilderFactory.buildWayPoints = function(document_name,cellArray){
        var buildersList = builder.create("kml")
            .att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name).up();

            //var item = xml.ele("name");
            cellArray.forEach(function(item){
                buildersList
                    .ele("Placemark")
                    .ele("Point")
                    .ele("coordinates",item)
            });
            cellArray.forEach(function(item){
                //buildersList.
        })
        var xml = buildersList.end({pretty: true});
        console.log(xml);
    }

    /**
     * Add polygons to XML Builder file
     * @param cellsArray
     */
    xmlBuilderFactory.addCell = function(cellsArray){
        //this.xml.
        cellsArray.forEach(function(cell){
            //create polygons by adding 5 gps points that makes up cell

        });
    }

    /**
     *  Add gps points to XML builder file
     * @param pointArray
     */
    xmlBuilderFactory.addPoint = function(pointArray){
            pointArray.forEach(function(point){
                //create placemarks of all the points in array
            })
    }
    return xmlBuilderFactory;
}).call(this);

exports.xmlBuilderFactory = xmlBuilderFactory;

/*
var xmlBuilder = xmlBuilderFactory.buildWayPoints("S2_Edenvale_cells.kml",
    ["28.033954797,-26.029433325",
    "28.023715353,-26.060654974",
    "28.033840468,-26.100056928"]);*/

//var cells = ["2203795067297071104","2203801664366837760","2203792455956955136","2203681267843596288","2203794242663350272"];
var waypoints = ["28.033954797,-26.029433325", "28.023715353,-26.060654974", "28.033840468,-26.100056928"];
/*
var cells = redis.getCityGrid(function(cells){
    //logger.log("GRID ==="+cells);
    var s2cells = s2common.getVertexArrayfromCells(cells);
    xmlBuilderFactory.buildCells("S2_Paulshof_cells.kml",s2cells,waypoints,"ff1334fc","2.1");
});
*/