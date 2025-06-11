/*
*
*	NFC通信エラー管理モジュール
*		NFCErrors.js
*		import { NFCError, ERROR_CODES } from './modules/NFCErrors.js';
*	メンテナンス履歴
*		2025/01/XX Ver.1.0.0 新規作成
*
*******************************************************************/

/**
 * NFCカスタムエラークラス
 */
export class NFCError extends Error {
	constructor(code, message, details = '') {
		super(message);
		this.name = 'NFCError';
		this.code = code;
		this.details = details;
	}

	/**
	 * エラー情報を文字列として返す
	 */
	toString() {
		return `${this.name}(${this.code}): ${this.message}${this.details ? ` - ${this.details}` : ''}`;
	}
}

/**
 * エラーコード定数
 */
export const ERROR_CODES = {
	// 通常ステータス（100番台）
	RDR_HEADER_SEQ_MISMATCH: 100,	// RDRヘッダの連番が異なっている(Recive)
	SLOT_STATUS_NORMAL: 101,		// Slotのステータス正常(Recive)
	ICC_ACTIVE: 104,				// ICCが存在しアクティブです(Recive)
	ICC_INACTIVE: 105,				// ICCが存在し非アクティブです(Recive)
	ICC_NOT_EXIST: 106,				// ICCが存在しません(Recive)
	MEMORY_WRITE_LIMIT: 110,		// メモリ書き換え回数が上限を超えています(Write)
	POLLING_NO_CARD: 120,			// ポーリング不可カード未検出
	POLLING_NOT_DETECTED: 130,		// ポーリングによりカード検出されていません

	// エラーステータス（500番台以上）
	RDR_HEADER_LENGTH_ERROR: 501,	// RDRヘッダの長さが10バイト以下(Recive)
	RDR_HEADER_TYPE_ERROR: 502,		// RDRヘッダのタイプが0x83以外です(Recive)
	RDR_HEADER_SLOT_ERROR: 503,		// RDRヘッダのスロットが0以外です(Recive)
	SLOT_STATUS_ERROR: 504,			// Slotのステータスがエラー(Recive)
	SLOT_TIME_EXTENSION: 505,		// Slotの時間延長が要求された(Recive)
	RESPONSE_STATUS_ERROR: 510,		// レスポンスエラー (Status1 0x90 Status2 0x00 以外)
	RESPONSE_CODE_ERROR_C003: 511,	// レスポンスエラー(0xC0 0x03 以外)
	RESPONSE_CODE_ERROR_009000: 512,// レスポンスエラー(0x00 0x90 0x00 以外)
	RESPONSE_LENGTH_SIZE_ERROR: 513,// レスポンスレングスサイズ取得エラー
	RESPONSE_LENGTH_MISMATCH: 514,	// レスポンスレングスエラー
	USB_TRANSFER_OUT_FAILED: 520,	// USB Device TransferOutで転送要求失敗
	USB_TRANSFER_OUT_SIZE_ERROR: 521,// USB Device TransferOutで転送要求したバイト数が不正
	USB_CLOSE_FAILED: 530,			// USB Device クローズ失敗
	USB_RECEIVE_SIZE_ERROR: 540,	// USB Device Receive リクエストバイト数が不正
	USB_RECEIVE_TIMEOUT: 541,		// USB Device Receive タイムアウト
	USB_TRANSFER_IN_FAILED: 550,	// USB Device TransferInで受信要求失敗
	POLLING_RESPONSE_CODE_ERROR: 560,// ポーリングのレスポンスコードが不正(01h以外)
	READ_RESPONSE_CODE_ERROR: 570,	// 読み込みのレスポンスコードが不正(07h以外)
	READ_MEMORY_FATAL_ERROR: 571,	// 読み込み時に致命的なメモリエラー発生 ステータス2 0x70
	READ_ERROR: 572,				// 読み込み時にエラー発生
	WRITE_RESPONSE_CODE_ERROR: 580,	// 書き込みのレスポンスコードが不正(09h以外)
	WRITE_MEMORY_FATAL_ERROR: 581,	// 書き込み時に致命的なメモリエラー発生 ステータス2 0x70
	WRITE_ERROR: 582,				// 書き込み時にエラー発生
	UNSUPPORTED_DEVICE: 900,		// カードリーダーがサポート外の機種です
};

/**
 * エラーメッセージ定数
 */
export const ERROR_MESSAGES = {
	[ERROR_CODES.RDR_HEADER_SEQ_MISMATCH]: 'RDRヘッダの連番が異なっている(Recive)',
	[ERROR_CODES.SLOT_STATUS_NORMAL]: 'Slotのステータス正常(Recive)',
	[ERROR_CODES.ICC_ACTIVE]: 'ICCが存在しアクティブです(Recive)',
	[ERROR_CODES.ICC_INACTIVE]: 'ICCが存在し非アクティブです(Recive)',
	[ERROR_CODES.ICC_NOT_EXIST]: 'ICCが存在しません(Recive)',
	[ERROR_CODES.MEMORY_WRITE_LIMIT]: 'メモリ書き換え回数が上限を超えています(Write)',
	[ERROR_CODES.POLLING_NO_CARD]: 'ポーリング不可カード未検出',
	[ERROR_CODES.POLLING_NOT_DETECTED]: 'ポーリングによりカード検出されていません',
	[ERROR_CODES.RDR_HEADER_LENGTH_ERROR]: 'RDRヘッダの長さが10バイト以下(Recive)',
	[ERROR_CODES.RDR_HEADER_TYPE_ERROR]: 'RDRヘッダのタイプが0x83以外です(Recive)',
	[ERROR_CODES.RDR_HEADER_SLOT_ERROR]: 'RDRヘッダのスロットが0以外です(Recive)',
	[ERROR_CODES.SLOT_STATUS_ERROR]: 'Slotのステータスがエラー(Recive)',
	[ERROR_CODES.SLOT_TIME_EXTENSION]: 'Slotの時間延長が要求された(Recive)',
	[ERROR_CODES.RESPONSE_STATUS_ERROR]: 'レスポンスエラー (Status1 0x90 Status2 0x00 以外)',
	[ERROR_CODES.RESPONSE_CODE_ERROR_C003]: 'レスポンスエラー(0xC0 0x03 以外)',
	[ERROR_CODES.RESPONSE_CODE_ERROR_009000]: 'レスポンスエラー(0x00 0x90 0x00 以外)',
	[ERROR_CODES.RESPONSE_LENGTH_SIZE_ERROR]: 'レスポンスレングスサイズ取得エラー(レスポンスヘッダのデータ長が128バイト以上の時のサイズ取得に失敗)',
	[ERROR_CODES.RESPONSE_LENGTH_MISMATCH]: 'レスポンスレングスエラー(レスポンスヘッダのデータ長より実データ長が小さい)',
	[ERROR_CODES.USB_TRANSFER_OUT_FAILED]: 'USB Device TransferOutで転送要求失敗',
	[ERROR_CODES.USB_TRANSFER_OUT_SIZE_ERROR]: 'USB Device TransferOutで転送要求したバイト数が転送要素のバイト数より少ない',
	[ERROR_CODES.USB_CLOSE_FAILED]: 'USB Device クローズ失敗',
	[ERROR_CODES.USB_RECEIVE_SIZE_ERROR]: 'USB Device Receive リクエストバイト数が不正',
	[ERROR_CODES.USB_RECEIVE_TIMEOUT]: 'USB Device Receive タイムアウト',
	[ERROR_CODES.USB_TRANSFER_IN_FAILED]: 'USB Device TransferInで受信要求失敗',
	[ERROR_CODES.POLLING_RESPONSE_CODE_ERROR]: 'ポーリングのレスポンスコードが不正(01h以外)',
	[ERROR_CODES.READ_RESPONSE_CODE_ERROR]: '読み込みのレスポンスコードが不正(07h以外)',
	[ERROR_CODES.READ_MEMORY_FATAL_ERROR]: '読み込み時に致命的なメモリエラー発生 ステータス2 0x70',
	[ERROR_CODES.READ_ERROR]: '読み込み時にエラー発生',
	[ERROR_CODES.WRITE_RESPONSE_CODE_ERROR]: '書き込みのレスポンスコードが不正(09h以外)',
	[ERROR_CODES.WRITE_MEMORY_FATAL_ERROR]: '書き込み時に致命的なメモリエラー発生 ステータス2 0x70',
	[ERROR_CODES.WRITE_ERROR]: '書き込み時にエラー発生',
	[ERROR_CODES.UNSUPPORTED_DEVICE]: 'カードリーダーがサポート外の機種です',
};

/**
 * エラーハンドリングユーティリティクラス
 */
export class NFCErrorHandler {
	constructor(options = {}) {
		this.warning = options.warning ?? true;
		this.debug = options.debug ?? false;
	}

	/**
	 * エラーメッセージを取得
	 */
	getErrorMessage(code) {
		return ERROR_MESSAGES[code] || "不明なエラーコードです";
	}

	/**
	 * エラーオブジェクトかどうかを判定
	 */
	isError(obj) {
		return obj && typeof obj === 'object' && 'code' in obj;
	}

	/**
	 * エラーを処理（表示または例外発生）
	 */
	handleError(error, context = '') {
		if (!this.isError(error)) return;

		const message = this.getErrorMessage(error.code);
		const details = error.message ? ` ${error.message}` : '';
		const contextInfo = context ? ` ${context}` : '';
		
		if (error.code >= 500) {
			// 重大なエラーは例外として発生
			const errorMsg = `${message}${details}${contextInfo}`;
			const nfcError = new NFCError(error.code, errorMsg);
			console.error(`Error(${error.code}) [ ${errorMsg} ]`);
			throw nfcError;
		} else {
			// 警告レベルのエラーはログ出力のみ
			if (this.warning) {
				console.log(`(${error.code}) [ ${message}${details} ]`);
			}
		}
	}

	/**
	 * 複数のエラーを処理
	 */
	handleErrors(errors, context = '') {
		if (!Array.isArray(errors)) return;
		
		for (const error of errors) {
			if (error && error.Error) {
				this.handleError(error.Error, context);
			}
		}
	}
}