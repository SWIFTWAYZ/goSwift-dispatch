/**
 * Created by tinyiko on 2017/06/04.
 */
var redis = require("../redis/redisProvider").provider;
var s2common = require("../s2geometry/s2common").s2common;
var logger = require("../config/logutil").logger
var builder = require("xmlbuilder");

var xmlBuilderFactory = (function(){

    /**
     * factory function to build an XMl document with cellArray and
     * GPS track points
     */
    function xmlBuilderFactory(builder,document_name){
            builder
            .att({"version":"1.0", "encoding":"UTF-8"})
            .ele("kml").att({"xmlns":"http://www.opengis.net/kml/2.2",
                "xmlns:gx":"http://www.google.com/kml/ext/2.2",
                "xmlns:kml":"http://www.opengis.net/kml/2.2",
                "xmlns:atom":"http://www.w3.org/2005/Atom"})
            .ele("Document")
            .ele("name",document_name);

            //var item = xml.ele("name");
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
    xmlBuilderFactory.addPoints = function(buildersList,pointArray){
        pointArray.forEach(function(item){
            buildersList
                .ele("Placemark")
                .ele("Point")
                .ele("coordinates",item +","+item)
        });
    }
    return xmlBuilderFactory;
}).call(this);

exports.xmlBuilderFactory = xmlBuilderFactory;

var buildersList = builder.create("xml");
var xmlBuilder = new xmlBuilderFactory(buildersList,"S2_Edenvale_cells.kml");
xmlBuilderFactory.addPoints(buildersList,["26.0001","27.00023","27.45678"]);

var xml = buildersList.end({pretty: true});
logger.log(xml);

