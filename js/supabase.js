// LoadPro — Supabase Client
// SUBSTITUIR pelas keys reais do projeto
const SUPABASE_URL = 'https://sclrcxwiwfiqnxguxvbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjbHJjeHdpd2ZpcW54Z3V4dmJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjM2NzYsImV4cCI6MjA5MDAzOTY3Nn0._sH7CVQ38LO4RTQFHGmUPpZX4Js1SYmRwjau1Hc5cTM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
