/**
 * Created by tinyiko on 2017/04/22.
 */

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
};

exports.decimalToBinary = decimalToBinary;