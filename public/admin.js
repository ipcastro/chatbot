(() => {
	// Use a mesma base do backend já usada no projeto
	const backendBase = 'https://chatbot-dny3.onrender.com';
	let adminToken = '';

	const el = (id) => document.getElementById(id);
	const panel = el('panel');
	const feedback = el('feedback');
	const totalConversas = el('total-conversas');
	const totalMensagens = el('total-mensagens');
	const ultimasList = el('ultimas-list');
	const systemInstruction = el('system-instruction');
	const saveStatus = el('save-status');

	function setFeedback(message, type = 'error') {
		feedback.textContent = message || '';
		feedback.className = `small ${type === 'success' ? 'success' : 'error'}`;
	}

	function showPanel(show) {
		panel.classList.toggle('hidden', !show);
		document.getElementById('logout-btn').classList.toggle('hidden', !show);
		document.getElementById('login-btn').classList.toggle('hidden', show);
		document.getElementById('admin-pass').disabled = show;
	}

	async function fetchWithAuth(url, options = {}) {
		const headers = Object.assign({}, options.headers || {}, {
			'Authorization': `Bearer ${adminToken}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		});
		const res = await fetch(`${backendBase}${url}`, { ...options, headers });
		if (!res.ok) {
			let serverMsg = '';
			try {
				const data = await res.json();
				serverMsg = data?.error || data?.message || '';
			} catch (_) { /* ignore parse errors */ }
			if (res.status === 403) throw new Error(serverMsg || 'Acesso negado');
			throw new Error(serverMsg || `Erro ${res.status}`);
		}
		return res;
	}

	async function carregarStats() {
		const res = await fetchWithAuth('/api/admin/stats');
		const data = await res.json();
		totalConversas.textContent = data.totalConversas;
		totalMensagens.textContent = data.totalMensagens;
		ultimasList.innerHTML = '';
		(data.ultimasConversas || []).forEach((c) => {
			const li = document.createElement('div');
			li.className = 'item';
			const d = new Date(c.startTime);
			li.innerHTML = `<strong>${c.titulo || 'Conversa sem título'}</strong><br><span class="small">${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')} — ${c.botId || ''}</span>`;
			ultimasList.appendChild(li);
		});
	}

	async function carregarSystemInstruction() {
		const res = await fetchWithAuth('/api/admin/system-instruction');
		if (!res.ok) throw new Error('Falha ao obter instrução');
		const data = await res.json();
		systemInstruction.value = data.systemInstruction || '';
	}

	async function salvarSystemInstruction() {
		saveStatus.textContent = 'Salvando...';
		const payload = { systemInstruction: systemInstruction.value };
		const res = await fetchWithAuth('/api/admin/system-instruction', {
			method: 'POST',
			body: JSON.stringify(payload)
		});
		if (!res.ok) throw new Error('Falha ao salvar instrução');
		const data = await res.json();
		systemInstruction.value = data.systemInstruction || systemInstruction.value;
		saveStatus.textContent = 'Salvo com sucesso.';
		setTimeout(() => saveStatus.textContent = '', 2000);
	}

	// Eventos
	document.getElementById('login-btn').addEventListener('click', async () => {
		const pass = document.getElementById('admin-pass').value.trim();
		if (!pass) { setFeedback('Informe a senha.'); return; }
		adminToken = pass;
		try {
			await carregarStats();
			await carregarSystemInstruction();
			showPanel(true);
			setFeedback('Acesso concedido.', 'success');
		} catch (e) {
			adminToken = '';
			showPanel(false);
			setFeedback(e.message || 'Falha na autenticação.');
		}
	});

	document.getElementById('logout-btn').addEventListener('click', () => {
		adminToken = '';
		showPanel(false);
		setFeedback('Sessão encerrada.', 'success');
	});

	document.getElementById('reload-instruction').addEventListener('click', async () => {
		try {
			await carregarSystemInstruction();
			setFeedback('Instrução recarregada.', 'success');
		} catch (e) {
			setFeedback(e.message || 'Erro ao recarregar instrução.');
		}
	});

	document.getElementById('save-instruction').addEventListener('click', async () => {
		try {
			await salvarSystemInstruction();
			setFeedback('Instrução atualizada.', 'success');
		} catch (e) {
			setFeedback(e.message || 'Erro ao salvar instrução.');
		}
	});
})();


