/*
*
*	NFCデータ処理ユーティリティモジュール
*		NFCDataUtils.js
*		import { NFCDataUtils } from './modules/NFCDataUtils.js';
*	メンテナンス履歴
*		2025/01/XX Ver.1.0.0 新規作成
*
*******************************************************************/

/**
 * NFCデータ処理ユーティリティクラス
 */
export class NFCDataUtils {
	/**
	 * デフォルト値を設定
	 */
	static defaultValue(param, defaultVal) {
		return param !== undefined ? param : defaultVal;
	}

	/**
	 * 配列の部分切り出し
	 */
	static arraySlice(array, offset, length) {
		length = this.defaultValue(length, array.length - offset);
		const result = [];
		this.arrayCopy(result, 0, array, offset, length);
		return result;
	}

	/**
	 * 配列のコピー
	 */
	static arrayCopy(dest, destOffset, src, srcOffset, length) {
		srcOffset = this.defaultValue(srcOffset, 0);
		length = this.defaultValue(length, src.length);

		for (let i = 0; i < length; i++) {
			dest[destOffset + i] = src[srcOffset + i];
		}
		return dest;
	}

	/**
	 * バイト配列を16進文字列に変換
	 */
	static bytesToHexs(bytes, separator = ' ') {
		return bytes.map(byte => {
			const str = byte.toString(16);
			return byte < 0x10 ? '0' + str : str;
		}).join(separator).toUpperCase();
	}

	/**
	 * 配列を16進文字列に変換
	 */
	static arrayToHexs(array, separator = ' ') {
		const temp = this.arraySlice(array, 0, array.length);
		return this.bytesToHexs(temp, separator);
	}

	/**
	 * 配列の指定位置から16進文字列に変換
	 */
	static arrayToHexsOffset(array, offset = 0, length, separator = ' ') {
		offset = this.defaultValue(offset, 0);
		length = this.defaultValue(length, array.length - offset);
		
		const temp = this.arraySlice(array, offset, length);
		return this.bytesToHexs(temp, separator);
	}

	/**
	 * DataViewを配列に変換
	 */
	static dataViewToArray(dataView) {
		const result = new Array(dataView.byteLength);
		for (let i = 0; i < dataView.byteLength; i++) {
			result[i] = dataView.getUint8(i);
		}
		return result;
	}

	/**
	 * バイナリデータを文字列に変換（0x00を0x20に置換）
	 */
	static binToString(data) {
		// データをコピーして0x00を0x20に置換
		const processedData = data.slice();
		for (let i = 0; i < processedData.length; i++) {
			if (processedData[i] === 0x00) {
				processedData[i] = 0x20;
			}
		}
		
		const textDecoder = new TextDecoder("utf-8");
		return textDecoder.decode(Uint8Array.from(processedData).buffer);
	}

	/**
	 * UTF-8対応のバイナリデータを文字列に変換（改良版）
	 */
	static binToStringUTF8(data) {
		try {
			// 末尾の0x00を除去（パディング部分）
			let endIndex = data.length;
			for (let i = data.length - 1; i >= 0; i--) {
				if (data[i] !== 0x00) {
					endIndex = i + 1;
					break;
				}
			}
			
			if (endIndex === 0) {
				return '';
			}
			
			const trimmedData = data.slice(0, endIndex);
			const textDecoder = new TextDecoder("utf-8", { fatal: false });
			return textDecoder.decode(Uint8Array.from(trimmedData).buffer);
		} catch (error) {
			// UTF-8デコードに失敗した場合は従来の方法でフォールバック
			console.warn('UTF-8 decode failed, falling back to simple method:', error);
			return this.binToString(data);
		}
	}

	/**
	 * 文字列をバイト配列に変換
	 */
	static stringToBytes(str) {
		const encoder = new TextEncoder();
		return Array.from(encoder.encode(str));
	}

	/**
	 * 文字列をUTF-8バイト配列に変換（16バイト制限対応）
	 */
	static stringToBytesUTF8(str, maxBytes = 16) {
		const encoder = new TextEncoder();
		let encoded = encoder.encode(str);
		
		// 16バイトを超える場合は切り詰める（UTF-8境界を考慮）
		if (encoded.length > maxBytes) {
			encoded = this._truncateUTF8(encoded, maxBytes);
		}
		
		return Array.from(encoded);
	}

	/**
	 * UTF-8バイト配列を指定バイト数で安全に切り詰める
	 */
	static _truncateUTF8(bytes, maxBytes) {
		if (bytes.length <= maxBytes) {
			return bytes;
		}
		
		// UTF-8の文字境界を考慮して切り詰める
		let cutPoint = maxBytes;
		
		// 最後のバイトがUTF-8マルチバイト文字の途中でないか確認
		for (let i = maxBytes - 1; i >= Math.max(0, maxBytes - 4); i--) {
			const byte = bytes[i];
			
			// UTF-8の先頭バイトかチェック
			if ((byte & 0x80) === 0) {
				// ASCII文字（1バイト）
				cutPoint = i + 1;
				break;
			} else if ((byte & 0xE0) === 0xC0) {
				// 2バイト文字の先頭
				cutPoint = i + 2 <= maxBytes ? i + 2 : i;
				break;
			} else if ((byte & 0xF0) === 0xE0) {
				// 3バイト文字の先頭
				cutPoint = i + 3 <= maxBytes ? i + 3 : i;
				break;
			} else if ((byte & 0xF8) === 0xF0) {
				// 4バイト文字の先頭
				cutPoint = i + 4 <= maxBytes ? i + 4 : i;
				break;
			}
		}
		
		return bytes.slice(0, cutPoint);
	}

	/**
	 * 文字列の実際のUTF-8バイト長を取得
	 */
	static getUTF8ByteLength(str) {
		return new TextEncoder().encode(str).length;
	}

	/**
	 * 指定バイト数に収まるように文字列を切り詰める
	 */
	static truncateStringToBytes(str, maxBytes = 16) {
		const encoder = new TextEncoder();
		const decoder = new TextDecoder();
		
		if (encoder.encode(str).length <= maxBytes) {
			return str;
		}
		
		// バイナリサーチで最大長を見つける
		let left = 0;
		let right = str.length;
		let result = '';
		
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const substring = str.substring(0, mid);
			const byteLength = encoder.encode(substring).length;
			
			if (byteLength <= maxBytes) {
				result = substring;
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}
		
		return result;
	}

	/**
	 * 指定長にパディング（文字列）
	 */
	static padString(str, length, padChar = ' ') {
		return str.padEnd(length, padChar);
	}

	/**
	 * 指定長にパディング（バイト配列）
	 */
	static padBytes(bytes, length, padByte = 0x00) {
		const result = bytes.slice();
		while (result.length < length) {
			result.push(padByte);
		}
		return result;
	}

	/**
	 * リトルエンディアンでバイト配列に変換
	 */
	static toLittleEndian(value, byteLength = 4) {
		const result = [];
		for (let i = 0; i < byteLength; i++) {
			result.push((value >> (i * 8)) & 0xFF);
		}
		return result;
	}

	/**
	 * リトルエンディアンから数値に変換
	 */
	static fromLittleEndian(bytes) {
		let result = 0;
		for (let i = 0; i < bytes.length; i++) {
			result |= (bytes[i] << (i * 8));
		}
		return result;
	}

	/**
	 * ビッグエンディアンでバイト配列に変換
	 */
	static toBigEndian(value, byteLength = 4) {
		const result = [];
		for (let i = byteLength - 1; i >= 0; i--) {
			result.push((value >> (i * 8)) & 0xFF);
		}
		return result;
	}

	/**
	 * ビッグエンディアンから数値に変換
	 */
	static fromBigEndian(bytes) {
		let result = 0;
		for (let i = 0; i < bytes.length; i++) {
			result = (result << 8) | bytes[i];
		}
		return result;
	}

	/**
	 * 配列が等しいかチェック
	 */
	static arrayEquals(arr1, arr2) {
		if (arr1.length !== arr2.length) return false;
		for (let i = 0; i < arr1.length; i++) {
			if (arr1[i] !== arr2[i]) return false;
		}
		return true;
	}

	/**
	 * 配列内の指定パターンを検索
	 */
	static findPattern(array, pattern, startIndex = 0) {
		for (let i = startIndex; i <= array.length - pattern.length; i++) {
			let found = true;
			for (let j = 0; j < pattern.length; j++) {
				if (array[i + j] !== pattern[j]) {
					found = false;
					break;
				}
			}
			if (found) return i;
		}
		return -1;
	}

	/**
	 * バイト配列の妥当性チェック
	 */
	static validateByteArray(array, minLength = 0, maxLength = Infinity) {
		if (!Array.isArray(array)) return false;
		if (array.length < minLength || array.length > maxLength) return false;
		return array.every(byte => 
			Number.isInteger(byte) && byte >= 0 && byte <= 255
		);
	}

	/**
	 * チェックサムを計算（XOR）
	 */
	static calculateXorChecksum(bytes) {
		return bytes.reduce((checksum, byte) => checksum ^ byte, 0);
	}

	/**
	 * チェックサムを計算（加算）
	 */
	static calculateSumChecksum(bytes) {
		return bytes.reduce((sum, byte) => (sum + byte) & 0xFF, 0);
	}

	/**
	 * デバッグ用：配列の内容を詳細表示
	 */
	static debugArray(array, label = 'Array') {
		console.log(`${label} (${array.length} bytes):`, this.arrayToHexs(array));
		console.log(`${label} (ASCII):`, this.binToString(array));
	}

	/**
	 * スリープ処理
	 */
	static async sleep(milliseconds) {
		return new Promise(resolve => setTimeout(resolve, milliseconds));
	}
}