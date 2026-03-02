const BASE = '/api';

export async function getCharacters() {
  const res = await fetch(`${BASE}/characters`);
  if (!res.ok) throw new Error('Failed to fetch characters');
  return res.json();
}

export async function getCharacter(id) {
  const res = await fetch(`${BASE}/characters/${id}`);
  if (!res.ok) throw new Error('Failed to fetch character');
  return res.json();
}

export async function getCharacterHistory(id) {
  const res = await fetch(`${BASE}/characters/${id}/history`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function addCharacter(name, realm, region, adminToken) {
  const res = await fetch(`${BASE}/characters`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ name, realm, region }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add character');
  }
  return res.json();
}

export async function deleteCharacter(id, adminToken) {
  const res = await fetch(`${BASE}/characters/${id}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete character');
  }
  return res.json();
}

export async function refreshCharacter(id, adminToken) {
  const res = await fetch(`${BASE}/characters/${id}/refresh`, {
    method: 'POST',
    headers: { 'X-Admin-Token': adminToken },
  });
  if (!res.ok) throw new Error('Failed to refresh');
  return res.json();
}
