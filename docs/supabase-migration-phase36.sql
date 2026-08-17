-- ================================================================
-- Phase 36 マイグレーション — Chatwork連携（受信トレイへの取り込み）
-- クライアントとのChatworkルームでのやり取りを受信トレイ(messages)に取り込み、
-- 未返信のままなら既存のリマインド機能で公式LINEに通知する。
-- Supabase Dashboard → SQL Editor に貼り付けて Run してください
-- （ALTER TYPE ... ADD VALUE は他の文と分けて先に単独実行すること）
-- ================================================================

ALTER TYPE message_channel ADD VALUE 'chatwork';
