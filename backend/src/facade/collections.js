const $ = require('../core/app');
const { SUBS_KEY, COLLECTIONS_KEY } = require('./constants');
const { getPlatformFromHeaders, getFlowHeaders } = require('./subscriptions');
const { produceArtifact } = require('./artifacts');

function register($app) {
	if (!$.read(COLLECTIONS_KEY)) $.write({}, COLLECTIONS_KEY);

	$app.get("/download/collection/:name", downloadCollection);

	$app.route('/api/collection/:name').get(getCollection).patch(updateCollection).delete(deleteCollection);

	$app.route('/api/collections').get(getAllCollections).post(createCollection);
}

// collection API
async function downloadCollection(req, res) {
	const { name } = req.params;
	const { raw } = req.query || 'false';
	const platform = req.query.target || getPlatformFromHeaders(req.headers) || 'JSON';

	const allCollections = $.read(COLLECTIONS_KEY);
	const collection = allCollections[name];

	$.info(`正在下载组合订阅：${name}`);

	// forward flow header from the first subscription in this collection
	const allSubs = $.read(SUBS_KEY);
	const subs = collection['subscriptions'];
	if (subs.length > 0) {
		const sub = allSubs[subs[0]];
		const flowInfo = await getFlowHeaders(sub.url);
		if (flowInfo) {
			res.set('subscription-userinfo', flowInfo);
		}
	}

	if (collection) {
		try {
			const output = await produceArtifact({
				type: 'collection',
				item: collection,
				platform,
				noProcessor: raw
			});
			if (platform === 'JSON') {
				res.set('Content-Type', 'application/json;charset=utf-8').send(output);
			} else {
				res.send(output);
			}
		} catch (err) {
			$.notify(`🌍 『 𝑺𝒖𝒃-𝑺𝒕𝒐𝒓𝒆 』 下载组合订阅失败`, `❌ 下载组合订阅错误：${name}！`, `🤔 原因：${err}`);
			res.status(500).json({
				status: 'failed',
				message: err
			});
		}
	} else {
		$.notify(`🌍 『 𝑺𝒖𝒃-𝑺𝒕𝒐𝒓𝒆 』 下载组合订阅失败`, `❌ 未找到组合订阅：${name}！`);
		res.status(404).json({
			status: 'failed'
		});
	}
}

function createCollection(req, res) {
	const collection = req.body;
	$.info(`正在创建组合订阅：${collection.name}`);
	const allCol = $.read(COLLECTIONS_KEY);
	if (allCol[collection.name]) {
		res.status(500).json({
			status: 'failed',
			message: `订阅集${collection.name}已存在！`
		});
	}
	// validate name
	if (/^[\w-_]*$/.test(collection.name)) {
		allCol[collection.name] = collection;
		$.write(allCol, COLLECTIONS_KEY);
		res.status(201).json({
			status: 'success',
			data: collection
		});
	} else {
		res.status(500).json({
			status: 'failed',
			message: `订阅集名称 ${collection.name} 中含有非法字符！名称中只能包含英文字母、数字、下划线、横杠。`
		});
	}
}

function getCollection(req, res) {
	const { name } = req.params;
	const collection = $.read(COLLECTIONS_KEY)[name];
	if (collection) {
		res.json({
			status: 'success',
			data: collection
		});
	} else {
		res.status(404).json({
			status: 'failed',
			message: `未找到订阅集：${name}!`
		});
	}
}

function updateCollection(req, res) {
	const { name } = req.params;
	let collection = req.body;
	const allCol = $.read(COLLECTIONS_KEY);
	if (allCol[name]) {
		const newCol = {
			...allCol[name],
			...collection
		};
		$.info(`正在更新组合订阅：${name}...`);
		// allow users to update collection name
		delete allCol[name];
		allCol[collection.name || name] = newCol;
		$.write(allCol, COLLECTIONS_KEY);
		res.json({
			status: 'success',
			data: newCol
		});
	} else {
		res.status(500).json({
			status: 'failed',
			message: `订阅集${name}不存在，无法更新！`
		});
	}
}

function deleteCollection(req, res) {
	const { name } = req.params;
	$.info(`正在删除组合订阅：${name}`);
	let allCol = $.read(COLLECTIONS_KEY);
	delete allCol[name];
	$.write(allCol, COLLECTIONS_KEY);
	res.json({
		status: 'success'
	});
}

function getAllCollections(req, res) {
	const allCols = $.read(COLLECTIONS_KEY);
	res.json({
		status: 'success',
		data: allCols
	});
}

module.exports = {
	register
};
