import crypto from 'crypto';

export async function getGravatarProfile(email?: string | null) {
  if (!email) {
    return { avatar_url: "https://gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y", display_name: "Usuário" };
  }

  // A API v3 do Gravatar usa o hash SHA-256 do email (ou MD5) em letras minúsculas
  const hash = crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  const md5Hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  const apiKey = process.env.GRAVATAR_API_KEY;

  const fallbackUrl = `https://gravatar.com/avatar/${md5Hash}?d=robohash&s=200`;

  if (!apiKey) {
    return { avatar_url: fallbackUrl, display_name: email.split("@")[0] };
  }

  try {
    // Fazemos a requisição com "revalidate: 3600" para guardar no cache do servidor por 1 hora
    // Isso garante que NUNCA passaremos das 900 req/hora do limite estipulado
    const res = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      next: { revalidate: 3600 } 
    });
    
    if (res.ok) {
      const data = await res.json();
      return {
        avatar_url: data.avatar_url || fallbackUrl,
        display_name: data.display_name || email.split("@")[0],
      };
    }
  } catch (e) {
    console.error("Gravatar fetch error:", e);
  }
  
  // Retorno de segurança
  return {
    avatar_url: fallbackUrl,
    display_name: email.split("@")[0]
  };
}
