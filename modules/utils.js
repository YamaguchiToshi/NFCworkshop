/*
 * NFC Testing Utilities Module
 * Common utility functions for NFC card operations
 */

export class NFCUtils {
    
    // Default value helper
    static defVal(param, def) {
        return (param === undefined) ? def : param;
    }

    // Array slice utility
    static arraySlice(array, offset, length) {
        let result;
        length = NFCUtils.defVal(length, array.length - offset);
        result = [];
        NFCUtils.arrayCopy(result, 0, array, offset, length);
        return result;
    }

    // Array copy utility
    static arrayCopy(dest, destOffset, src, srcOffset, length) {
        let idx;
        srcOffset = NFCUtils.defVal(srcOffset, 0);
        length = NFCUtils.defVal(length, src.length);

        for (idx = 0; idx < length; idx++) {
            dest[destOffset + idx] = src[srcOffset + idx];
        }
        return dest;
    }

    // Convert bytes to hex string
    static bytesToHexs(bytes, sep) {
        sep = NFCUtils.defVal(sep, ' ');
        return bytes.map(function(byte) {
            let str = byte.toString(16);
            return byte < 0x10 ? '0' + str : str;
        }).join(sep).toUpperCase();
    }

    // Convert array to hex string
    static arrayToHexs(array, offset, length, sep) {
        offset = NFCUtils.defVal(offset, 0);
        length = NFCUtils.defVal(length, array.length - offset);
        sep = NFCUtils.defVal(sep, '');

        let temp = NFCUtils.arraySlice(array, offset, length);
        return NFCUtils.bytesToHexs(temp, sep);
    }

    // Convert binary data to string
    static binToString(argData) {
        for (let i = 0; i < argData.length; i++) {
            if (argData[i] == 0x00) {
                argData[i] = 0x20;
            }
        }
        let textDecoder = new TextDecoder("utf-8");
        let retVal = textDecoder.decode(Uint8Array.from(argData).buffer);
        retVal = retVal.trim(' ');
        return retVal;
    }

    // Create audio beep (base64 encoded MP3)
    static createBeepAudio() {
        const BEEPSOUND = "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAADgAAAiQAYWFhYWFhYW1tbW1tbW15eXl5eXl5hoaGhoaGhpKSkpKSkpKenp6enp6eqqqqqqqqqra2tra2tra2wsLCwsLCws/Pz8/Pz8/b29vb29vb5+fn5+fn5/Pz8/Pz8/P/////////AAAAAExhdmM1Ni42MAAAAAAAAAAAAAAAACQAAAAAAAAAAAIkrpFKWwAAAAAAAAAAAAAAAAD/8xDEAALIAqgBQBAA//8/WH///UCAIAgq///zEsQBAzlK2AGAEAD/yvo+C///8WX5fwX/yP/zEMQCA2k+rAHAUACBbNb/q////0JgUmqH//MQxAEDATqsCAAOcMIP/ikVK3///icOwD7/8xDEAgNROqAQABpwNf/0AGSe///+M5Bq+P/zEMQBAwk6kAAAGnB+f/zIJd////h9KNX4//MQxAECyTqMAAAUcA7/8qEj2///g6eq+EX/8xDEAgNJOoQAA1UAn/8gAAmd///4OifVEP/zEMQBAuk6nDAADnBB8Bv/4a////FIeleB//MSxAIDETp8AANVCEZ//MQ3G///+wdq+Ai3//MQxAMC0TqAAAKPAP5QFf///xMGqv/cJv//8xDEBALhOowBQDgA54Pv///xMXr/768Ic//zEMQFA9kWhAGAOADqb8VjB+pv/4jdFUxB//MQxAIAAANIAcAAAE1FMy45OS41VVVVVVU=";
        const soundUri = "data:audio/mp3;base64," + BEEPSOUND;
        return new Audio(soundUri);
    }

    // Sleep utility
    static async sleep(msec) {
        return new Promise(resolve => setTimeout(resolve, msec));
    }

    // Format FeliCa read response
    static formatReadResponse(argRes) {
        let retVal = {
            Id: +NFCUtils.arraySlice(argRes, 0, 1),
            Code: +NFCUtils.arraySlice(argRes, 1, 1),
            IDm: NFCUtils.arraySlice(argRes, 2, 8),
            Status1: +NFCUtils.arraySlice(argRes, 10, 1),
            Status2: +NFCUtils.arraySlice(argRes, 11, 1),
            BlockCount: +NFCUtils.arraySlice(argRes, 12, 1),
            Data: NFCUtils.arraySlice(argRes, 13, argRes.length - 13),
        };
        
        retVal.IDmString = NFCUtils.arrayToHexs(retVal.IDm, 0, retVal.IDm.length);
        retVal.DataString = '';
        retVal.Datas = [];
        retVal.DatasString = [];
        
        for (let i = 0, offset = 13, blockLength = 16; i < retVal.BlockCount; ++i, offset += blockLength) {
            retVal.Datas[i] = NFCUtils.arraySlice(argRes, offset, blockLength);
            retVal.DatasString[i] = NFCUtils.binToString(retVal.Datas[i]);
            retVal.DataString += retVal.DatasString[i] + ',';
        }
        
        return retVal;
    }

    // Update UI message
    static updateUI(titleElement, messageElement, title, message) {
        if (titleElement) titleElement.innerText = title || '';
        if (messageElement) messageElement.innerText = message || '';
    }

    // Clear UI messages
    static clearUI(...elements) {
        elements.forEach(element => {
            if (element) element.innerText = '';
        });
    }
}