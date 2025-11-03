(function(){
  const el = id => document.getElementById(id);
  const msg = el('msg');

  function toBasic(user, pass){
    return 'Basic ' + btoa(unescape(encodeURIComponent(user + ':' + pass)));
  }

  async function loadPreferences(){
    const user = el('cfg-username').value.trim();
    const pass = el('cfg-password').value;
    if(!user || !pass){ msg.textContent = 'Informe usuário e senha antes.'; return; }
    try{
      msg.textContent = 'Carregando...';
      const res = await fetch('/api/user/preferences', { headers: { Authorization: toBasic(user,pass) } });
      if(!res.ok){ const d = await res.json().catch(()=>({})); msg.textContent = d.error || 'Erro ao carregar.'; return; }
      const data = await res.json();
      el('systemInstruction').value = data.systemInstruction || '';
      msg.textContent = 'Instrução carregada.';
    }catch(e){ console.error(e); msg.textContent = 'Erro ao carregar preferência.' }
  }

  async function savePreferences(){
    const user = el('cfg-username').value.trim();
    const pass = el('cfg-password').value;
    const systemInstruction = el('systemInstruction').value;
    if(!user || !pass){ msg.textContent = 'Informe usuário e senha antes.'; return; }
    try{
      msg.textContent = 'Salvando...';
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { Authorization: toBasic(user,pass), 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction })
      });
      if(!res.ok){ const d = await res.json().catch(()=>({})); msg.textContent = d.error || 'Erro ao salvar.'; return; }
      const data = await res.json();
      msg.textContent = data.message || 'Salvo com sucesso.';
    }catch(e){ console.error(e); msg.textContent = 'Erro ao salvar preferência.' }
  }

  el('btn-load').addEventListener('click', loadPreferences);
  el('btn-save').addEventListener('click', savePreferences);

})();
