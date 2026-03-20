// NaLinha — Cliente Supabase
// TODO: Substituir pelas credenciais do projeto NaLinha no Supabase
const SUPABASE_URL = 'https://jsydprrcyrjjxdmzrqpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWRwcnJjeXJqanhkbXpycXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIyMTYsImV4cCI6MjA4OTMxODIxNn0.ATGAx5AwErEZr2Lw4anu_JYHfwxlDLxiDK7hkgAwuus';

// Cria o cliente — window.supabase vem do CDN, sb é o nosso cliente
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
