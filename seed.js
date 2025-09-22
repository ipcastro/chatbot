require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Config = require('./models/Config');

async function run() {
	const mongoUri = process.env.MONGO_HISTORIA;
	if (!mongoUri) {
		console.error('ERRO: defina MONGO_HISTORIA no .env');
		process.exit(1);
	}

	const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
	const defaultSystemInstruction = process.env.SEED_SYSTEM_INSTRUCTION || 'Você é um assistente em PT-BR.';

	try {
		await mongoose.connect(mongoUri);
		console.log('Conectado ao MongoDB');

		// Seed da senha do admin (hash)
		const hash = await bcrypt.hash(adminPassword, 10);
		await Config.findOneAndUpdate(
			{ key: 'adminPasswordHash' },
			{ key: 'adminPasswordHash', value: hash },
			{ upsert: true, new: true }
		);
		console.log('Senha de admin seed criada/atualizada.');

		// Seed da system instruction (apenas se não existir)
		const existingSI = await Config.findOne({ key: 'systemInstruction' });
		if (!existingSI) {
			await Config.create({ key: 'systemInstruction', value: defaultSystemInstruction });
			console.log('System instruction padrão criada.');
		} else {
			console.log('System instruction já existente.');
		}

		console.log('Seed finalizado com sucesso.');
		process.exit(0);
	} catch (e) {
		console.error('Erro ao executar seed:', e);
		process.exit(1);
	}
}

run();


