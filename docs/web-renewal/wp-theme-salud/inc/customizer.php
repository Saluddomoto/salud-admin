<?php
/**
 * カスタマイザー設定
 * 「外観 > カスタマイズ」から、コードを触らずに主要テキスト・連絡先を編集できます。
 * 変更はリアルタイムでプレビューされ、「公開」で反映されます。
 * @package Salud
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function salud_customize_register( $wp_customize ) {

	// ===== 連絡先・リンク =====
	$wp_customize->add_section( 'salud_contact', array(
		'title'    => '連絡先・リンク（Salud）',
		'priority' => 30,
	) );
	$fields = array(
		'salud_tel'      => array( '電話番号', '050-6869-6588' ),
		'salud_line_url' => array( '公式LINE URL', 'https://line.me/R/ti/p/@388rsdlz' ),
		'salud_diag_url' => array( '補助金診断ツール URL', 'https://hojokin-app.vercel.app/' ),
		'salud_address'  => array( '住所', '東京都渋谷区道玄坂1丁目10番8号' ),
	);
	foreach ( $fields as $id => $f ) {
		$wp_customize->add_setting( $id, array( 'default' => $f[1], 'sanitize_callback' => 'wp_kses_post', 'transport' => 'refresh' ) );
		$wp_customize->add_control( $id, array( 'label' => $f[0], 'section' => 'salud_contact', 'type' => 'text' ) );
	}

	// ===== ヒーロー（TOP先頭）テキスト =====
	$wp_customize->add_section( 'salud_hero', array(
		'title'    => 'TOPヒーロー（見出し）',
		'priority' => 31,
	) );
	$hero = array(
		'salud_hero_catch' => array( 'キャッチ（HTML可・<br>や<span class="g">緑</span>）', 'その設備投資も、<br>AI開発も、<br><span class="g">半分は補助金で。</span>', 'textarea' ),
		'salud_hero_sub'   => array( 'サブ文', '補助金の診断・申請から、採択後の実行まで。設備導入・Web制作・AI開発——「使える補助金」を見つけ、成果につながる形で実装します。', 'textarea' ),
	);
	foreach ( $hero as $id => $f ) {
		$wp_customize->add_setting( $id, array( 'default' => $f[1], 'sanitize_callback' => 'wp_kses_post', 'transport' => 'refresh' ) );
		$wp_customize->add_control( $id, array( 'label' => $f[0], 'section' => 'salud_hero', 'type' => $f[2] ) );
	}

	// ===== セミナー（TOP通知・一覧ページ導入文） =====
	$wp_customize->add_section( 'salud_seminar_copy', array(
		'title'    => 'セミナー（通知文・導入文）',
		'priority' => 33,
	) );
	$seminar_copy = array(
		'salud_sem_notice'   => array( 'TOPヒーローの次回セミナー通知文（HTML可）', '<span class="d num">8/25（火）</span> AIで変わる中小企業の未来｜生産性向上と補助金活用法｜参加無料', 'textarea' ),
		'salud_sem_page_lede' => array( 'セミナー一覧ページの導入文', '8月25日（火）15:00〜16:00開催。AI活用による生産性向上・新たな事業創出と、それを後押しする「省力化投資補助金」「新事業進出・ものづくり商業サービス補助金」の活用法を、専門家がわかりやすく解説します。参加無料・希望者は個別相談会も。', 'textarea' ),
	);
	foreach ( $seminar_copy as $id => $f ) {
		$wp_customize->add_setting( $id, array( 'default' => $f[1], 'sanitize_callback' => 'wp_kses_post', 'transport' => 'refresh' ) );
		$wp_customize->add_control( $id, array( 'label' => $f[0], 'section' => 'salud_seminar_copy', 'type' => $f[2] ) );
	}

	// ===== OGP画像 =====
	$wp_customize->add_section( 'salud_ogp', array( 'title' => 'SNS共有画像（OGP）', 'priority' => 32 ) );
	$wp_customize->add_setting( 'salud_ogp_image', array( 'default' => '', 'sanitize_callback' => 'esc_url_raw' ) );
	$wp_customize->add_control( new WP_Customize_Image_Control( $wp_customize, 'salud_ogp_image', array(
		'label'   => 'SNSでシェアされた時の画像',
		'section' => 'salud_ogp',
	) ) );
}
add_action( 'customize_register', 'salud_customize_register' );
