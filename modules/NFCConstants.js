/*
*
*	NFC通信定数管理モジュール
*		NFCConstants.js
*		import { DEVICE_INFO_LIST, USB_SETUP_COMMANDS, FELICA_COMMANDS } from './modules/NFCConstants.js';
*	メンテナンス履歴
*		2025/01/XX Ver.1.0.0 新規作成
*
*******************************************************************/

/**
 * サポート対象デバイス情報リスト
 */
export const DEVICE_INFO_LIST = {
	1729: {
		vendorId: 1356,
		productId: 1729,
		modelName: "RC-S380/S",
		deviceType: "External"
	},
	1731: {
		vendorId: 1356,
		productId: 1731,
		modelName: "RC-S380/P",
		deviceType: "External"
	},
	3528: {
		vendorId: 1356,
		productId: 3528,
		modelName: "RC-S300/S",
		deviceType: "External"
	},
	3529: {
		vendorId: 1356,
		productId: 3529,
		modelName: "RC-S300/P",
		deviceType: "External"
	},
};

/**
 * USB デバイス初期化コマンド
 */
export const USB_SETUP_COMMANDS = {
	EndTransparentSession: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00],
		Sleep: 0
	},
	StartTransparentSession: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x81, 0x00, 0x00],
		Sleep: 0
	},
	TurnOffTheRF: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00],
		Sleep: 30
	},
	TurnOnTheRF: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x84, 0x00, 0x00],
		Sleep: 30
	},
	SwitchProtocolTypeF: {
		Com: [0xFF, 0x50, 0x00, 0x02, 0x04, 0x8F, 0x02, 0x03, 0x00, 0x00],
		Sleep: 0
	},
};

/**
 * USB デバイス終了処理コマンド
 */
export const USB_CLOSE_COMMANDS = {
	TurnOffTheRF: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x83, 0x00, 0x00],
		Sleep: 30
	},
	EndTransparentSession: {
		Com: [0xFF, 0x50, 0x00, 0x00, 0x02, 0x82, 0x00, 0x00],
		Sleep: 0
	},
};

/**
 * FeliCa ポーリング後の設定コマンド
 */
export const USB_POLLING_COMMANDS = {
	SwitchProtocolTypeF: {
		Com: [0xFF, 0x50, 0x00, 0x02, 0x04, 0x8F, 0x02, 0x03, 0x01, 0x00],
		Sleep: 0
	},
	TargetCardBaudRate: {
		Com: [0xFF, 0xCA, 0xF2, 0x00],
		Sleep: 0
	},
};

/**
 * FeliCa コマンド定数
 */
export const FELICA_COMMANDS = {
	// ポーリングコマンド
	POLLING: {
		BASE: [0x00, 0x00, 0xff, 0xff, 0x01, 0x00],
		COMMAND_CODE: 0x00,
		SYSTEM_CODE: [0xff, 0xff], // ワイルドカード指定
		REQUEST_CODE: 0x01, // システムコード要求
		TIME_SLOT: 0x00
	},
	
	// 読み込みコマンド
	READ: {
		BASE: [0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 1, 0x09, 0x00],
		COMMAND_CODE: 0x06,
		SERVICE_COUNT: 1,
		SERVICE_CODE: [0x09, 0x00], // リトルエンディアン 0x0009
		BLOCK_ACCESS_MODE: 0x80
	},
	
	// 書き込みコマンド
	WRITE: {
		BASE: [0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 1, 0x09, 0x00, 1],
		COMMAND_CODE: 0x08,
		SERVICE_COUNT: 1,
		SERVICE_CODE: [0x09, 0x00], // リトルエンディアン 0x0009
		BLOCK_COUNT: 1,
		BLOCK_ACCESS_MODE: 0x80,
		BLOCK_SIZE: 16 // 1ブロック16バイト
	}
};

/**
 * レスポンスコード定数
 */
export const RESPONSE_CODES = {
	POLLING: 0x01,
	READ: 0x07,
	WRITE: 0x09
};

/**
 * USB通信設定定数
 */
export const USB_CONFIG = {
	MAX_RECEIVE_SIZE: 513,
	TRANCEIVE_TAG: 0x95,
	SLOT_NUMBER: 0,
	DEFAULT_TIMEOUT: 100,
	RDR_HEADER: {
		TYPE: 0x83,
		LENGTH_OFFSET: 1,
		SLOT_OFFSET: 5,
		SEQ_OFFSET: 6,
		MIN_LENGTH: 10
	}
};

/**
 * プロトコル設定定数
 */
export const PROTOCOL_CONFIG = {
	VENDOR_ID: 1356, // Sony共通ベンダーID
	CONFIGURATION_VALUE: 1,
	INTERFACE_NUMBER: 0,
	ENDPOINT: {
		IN: 'in',
		OUT: 'out'
	}
};

/**
 * デバイスフィルタ生成
 */
export function generateDeviceFilters() {
	const filters = [];
	for (const pid in DEVICE_INFO_LIST) {
		const device = DEVICE_INFO_LIST[pid];
		filters.push({
			vendorId: device.vendorId,
			productId: parseInt(pid)
		});
	}
	return filters;
}

/**
 * デバイス情報取得
 */
export function getDeviceInfo(productId) {
	return DEVICE_INFO_LIST[productId] || null;
}

/**
 * サポート対象デバイスかどうかを判定
 */
export function isSupportedDevice(productId) {
	return productId in DEVICE_INFO_LIST;
}