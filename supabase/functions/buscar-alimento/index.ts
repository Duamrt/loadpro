// Edge Function: buscar-alimento
// Proxy FatSecret API com tradução PT→EN automática

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CONSUMER_KEY = Deno.env.get("FATSECRET_KEY") || ""
const CONSUMER_SECRET = Deno.env.get("FATSECRET_SECRET") || ""

// Mapa PT→EN dos alimentos fitness mais comuns
const TRADUCOES: Record<string, string> = {
  "frango": "chicken breast", "peito de frango": "chicken breast grilled",
  "frango grelhado": "grilled chicken breast", "coxa de frango": "chicken thigh",
  "sobrecoxa": "chicken thigh", "filé de frango": "chicken breast fillet",
  "carne": "beef", "carne moída": "ground beef lean", "patinho": "beef round lean",
  "alcatra": "beef sirloin", "filé mignon": "beef tenderloin",
  "carne de porco": "pork", "lombo": "pork loin",
  "peixe": "fish fillet", "tilápia": "tilapia fillet", "salmão": "salmon fillet",
  "atum": "tuna canned", "sardinha": "sardine canned", "camarão": "shrimp cooked",
  "ovo": "whole egg", "ovo cozido": "boiled egg", "ovo frito": "fried egg",
  "clara de ovo": "egg white cooked", "omelete": "omelette",
  "whey": "whey protein powder", "whey protein": "whey protein powder",
  "queijo cottage": "cottage cheese", "queijo branco": "fresh white cheese",
  "queijo minas": "fresh cheese low fat", "ricota": "ricotta cheese",
  "iogurte": "plain yogurt", "iogurte grego": "greek yogurt plain",
  "leite": "whole milk", "leite desnatado": "skim milk",
  "arroz": "white rice cooked", "arroz branco": "white rice cooked",
  "arroz integral": "brown rice cooked", "arroz cozido": "white rice cooked",
  "batata doce": "sweet potato baked", "batata": "potato boiled",
  "batata inglesa": "potato boiled", "mandioca": "cassava boiled",
  "macarrão": "pasta cooked", "espaguete": "spaghetti cooked",
  "pão": "white bread", "pão integral": "whole wheat bread",
  "pão francês": "french roll bread", "tapioca": "tapioca",
  "aveia": "rolled oats", "granola": "granola cereal", "cuscuz": "couscous cooked",
  "feijão": "kidney beans cooked", "feijão preto": "black beans cooked",
  "feijão carioca": "pinto beans cooked", "feijão branco": "white beans cooked",
  "lentilha": "lentils cooked", "grão de bico": "chickpeas cooked",
  "azeite": "olive oil", "óleo de coco": "coconut oil",
  "amendoim": "peanuts roasted", "pasta de amendoim": "peanut butter",
  "castanha": "brazil nuts", "castanha de caju": "cashew nuts",
  "nozes": "walnuts", "amêndoas": "almonds",
  "abacate": "avocado raw", "coco": "coconut raw",
  "banana": "banana raw", "maçã": "apple raw", "morango": "strawberry raw",
  "laranja": "orange raw", "mamão": "papaya raw", "manga": "mango raw",
  "melancia": "watermelon raw", "uva": "grapes raw", "abacaxi": "pineapple raw",
  "kiwi": "kiwi raw", "pera": "pear raw", "melão": "cantaloupe raw",
  "brócolis": "broccoli cooked", "espinafre": "spinach cooked",
  "alface": "lettuce raw", "tomate": "tomato raw", "pepino": "cucumber raw",
  "cenoura": "carrot raw", "abobrinha": "zucchini cooked", "berinjela": "eggplant cooked",
  "couve": "collard greens cooked", "repolho": "cabbage raw", "cebola": "onion raw",
  "pimentão": "bell pepper raw", "vagem": "green beans cooked",
  "salada": "mixed green salad",
  "mel": "honey", "açúcar": "white sugar", "manteiga": "butter",
  "cream cheese": "cream cheese", "requeijão": "cream cheese spread",
  "presunto": "ham sliced", "peito de peru": "turkey breast sliced",
  "bacon": "bacon cooked", "linguiça": "pork sausage cooked",
}

const NOMES_PT: Record<string, string> = {
  "Grilled Chicken Breast": "Peito de Frango Grelhado",
  "Skinless Chicken Breast": "Peito de Frango sem Pele",
  "Chicken Breast": "Peito de Frango", "Chicken Thigh": "Coxa/Sobrecoxa",
  "Ground Beef": "Carne Moída", "Beef Sirloin": "Alcatra",
  "Beef Round": "Patinho", "Beef Tenderloin": "Filé Mignon",
  "Egg": "Ovo", "Boiled Egg": "Ovo Cozido", "Fried Egg": "Ovo Frito",
  "Egg White": "Clara de Ovo", "Whole Egg": "Ovo Inteiro",
  "White Rice (Long-Grain, Cooked)": "Arroz Branco Cozido",
  "White Rice": "Arroz Branco", "Brown Rice": "Arroz Integral",
  "Cooked Rice": "Arroz Cozido",
  "Sweet Potato": "Batata Doce", "Baked Sweetpotato": "Batata Doce Assada",
  "Potato": "Batata", "Boiled Potato": "Batata Cozida",
  "Black Beans": "Feijão Preto", "Pinto Beans": "Feijão Carioca",
  "Beans": "Feijão", "Lentils": "Lentilha", "Chickpeas": "Grão de Bico",
  "Oats": "Aveia", "Rolled Oats": "Aveia em Flocos",
  "Banana": "Banana", "Apple": "Maçã", "Orange": "Laranja",
  "Olive Oil": "Azeite de Oliva", "Coconut Oil": "Óleo de Coco",
  "Peanut Butter": "Pasta de Amendoim", "Peanuts": "Amendoim",
  "Almonds": "Amêndoas", "Cashews": "Castanha de Caju",
  "Greek Yogurt": "Iogurte Grego", "Yogurt": "Iogurte",
  "Salmon": "Salmão", "Tilapia": "Tilápia", "Tuna": "Atum",
  "Broccoli": "Brócolis", "Spinach": "Espinafre",
  "Pasta": "Macarrão", "Spaghetti": "Espaguete",
  "Whole Wheat Bread": "Pão Integral", "Bread": "Pão",
  "Avocado": "Abacate", "Milk": "Leite", "Skim Milk": "Leite Desnatado",
  "Cottage Cheese": "Queijo Cottage", "Ricotta": "Ricota",
  "Turkey Breast": "Peito de Peru", "Ham": "Presunto",
  "Bacon": "Bacon", "Honey": "Mel", "Butter": "Manteiga",
  "Strawberry": "Morango", "Mango": "Manga", "Watermelon": "Melancia",
  "Grape": "Uva", "Pineapple": "Abacaxi", "Papaya": "Mamão",
  "Lettuce": "Alface", "Tomato": "Tomate", "Cucumber": "Pepino",
  "Carrot": "Cenoura", "Onion": "Cebola",
  "Whey Protein": "Whey Protein",
}

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function traduzir(termo: string): string {
  const lower = termo.toLowerCase().trim()
  const norm = semAcento(lower)
  // Busca exata (com e sem acento)
  if (TRADUCOES[lower]) return TRADUCOES[lower]
  for (const [pt, en] of Object.entries(TRADUCOES)) {
    if (semAcento(pt) === norm) return en
  }
  // Busca parcial (maior match)
  let melhor: string | null = null, tamanho = 0
  for (const [pt, en] of Object.entries(TRADUCOES)) {
    if ((lower.includes(pt) || norm.includes(semAcento(pt))) && pt.length > tamanho) {
      melhor = en; tamanho = pt.length
    }
  }
  return melhor || termo
}

function traduzirNome(nome: string): string {
  if (NOMES_PT[nome]) return NOMES_PT[nome]
  for (const [en, pt] of Object.entries(NOMES_PT)) {
    if (nome.toLowerCase().includes(en.toLowerCase())) return pt
  }
  return nome
}

function parseDescricao(desc: string) {
  return {
    porcao: desc.match(/Per (.+?) -/)?.[1] || "100g",
    kcal: parseFloat(desc.match(/Calories: ([\d.]+)/)?.[1] || "0"),
    gordura: parseFloat(desc.match(/Fat: ([\d.]+)/)?.[1] || "0"),
    carbo: parseFloat(desc.match(/Carbs: ([\d.]+)/)?.[1] || "0"),
    proteina: parseFloat(desc.match(/Protein: ([\d.]+)/)?.[1] || "0"),
  }
}

// OAuth 1.0 HMAC-SHA1
async function gerarSignature(method: string, url: string, params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
  ).join("&")
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sorted)}`
  const signingKey = `${encodeURIComponent(secret)}&`

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", encoder.encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(baseString))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

const CORS = {
  "Access-Control-Allow-Origin": "https://loadpro.com.br",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
  "Content-Type": "application/json",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const { q } = await req.json()
    if (!q || q.length < 2) return new Response("[]", { headers: CORS })

    const termoEN = traduzir(q)
    const url = "https://platform.fatsecret.com/rest/server.api"

    const params: Record<string, string> = {
      method: "foods.search",
      search_expression: termoEN,
      format: "json",
      max_results: "8",
      oauth_consumer_key: CONSUMER_KEY,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_nonce: String(Math.floor(Math.random() * 1000000)),
      oauth_version: "1.0",
    }

    params.oauth_signature = await gerarSignature("POST", url, params, CONSUMER_SECRET)

    const body = Object.keys(params).map(k =>
      `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
    ).join("&")

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })

    const data = await resp.json()
    const foods = data?.foods?.food || []

    // Priorizar genéricos, mas incluir marcas se não tiver genérico suficiente
    const genericos = foods.filter((f: any) => f.food_type === "Generic")
    const marcas = foods.filter((f: any) => f.food_type === "Brand")
    const combined = [...genericos, ...marcas]
    const resultado = combined
      .slice(0, 6)
      .map((f: any) => {
        const nutri = parseDescricao(f.food_description)
        return {
          id: f.food_id,
          nome: traduzirNome(f.food_name),
          nome_original: f.food_name,
          porcao: nutri.porcao,
          kcal: nutri.kcal,
          proteina: nutri.proteina,
          carbo: nutri.carbo,
          gordura: nutri.gordura,
        }
      })

    return new Response(JSON.stringify(resultado), { headers: CORS })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: CORS })
  }
})
