<?php
/**
 * Salud テーマ functions
 *
 * - スタイル読み込み
 * - テーマサポート
 * - カスタム投稿タイプ（実績・セミナー・お客様の声・補助金制度・お知らせ・サービス）
 * - AIO/SEO 用 構造化データ（JSON-LD）
 *
 * @package Salud
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SALUD_VERSION', '1.3.0' );
define( 'SALUD_GA4_ID', 'G-CVKNTW30MF' );

// カスタマイザー（外観 > カスタマイズ で主要テキストを編集）
require_once get_theme_file_path( 'inc/customizer.php' );

/**
 * テーマオプションの簡易取得ヘルパー。
 * 将来カスタマイザー/ACF に置き換えやすいよう1箇所に集約。
 */
function salud_opt( $key, $default = '' ) {
	$map = array(
		'line_url'    => 'https://line.me/R/ti/p/@388rsdlz',      // 公式LINE「補助金の窓口」
		'diag_url'    => 'https://hojokin-app.vercel.app/',        // 補助金診断ツール
		'tel'         => '050-6869-6588',
		'address'     => '東京都渋谷区道玄坂1丁目10番8号',
		'support_id'  => '109713007312',                          // 経営革新等支援機関 認定ID
	);
	$val = get_theme_mod( 'salud_' . $key, isset( $map[ $key ] ) ? $map[ $key ] : $default );
	return $val ? $val : $default;
}

/**
 * テーマサポート
 */
function salud_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'automatic-feed-links' );
	register_nav_menus( array(
		'primary' => 'グローバルナビ',
		'footer'  => 'フッターナビ',
	) );
}
add_action( 'after_setup_theme', 'salud_setup' );

/**
 * スタイル読み込み
 */
function salud_assets() {
	wp_enqueue_style( 'salud-style', get_stylesheet_uri(), array(), SALUD_VERSION );
}
add_action( 'wp_enqueue_scripts', 'salud_assets' );

/**
 * 不要な WP 既定出力を抑制（軽量化・Core Web Vitals 対策）
 */
function salud_cleanup() {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'rsd_link' );
}
add_action( 'init', 'salud_cleanup' );

/**
 * 検索エンジン非公開（noindex）。
 * ★ユーザー確認後に本公開する。公開OKになったら SALUD_NOINDEX を false にするか、
 *   この関数を削除して「設定 > 表示設定 > 検索エンジンでの表示」を調整する。
 */
if ( ! defined( 'SALUD_NOINDEX' ) ) {
	define( 'SALUD_NOINDEX', false ); // 2026-07-08 本公開に伴い解除
}
function salud_noindex() {
	if ( SALUD_NOINDEX ) {
		echo '<meta name="robots" content="noindex, nofollow, noarchive">' . "\n";
	}
}
add_action( 'wp_head', 'salud_noindex', 1 );

/**
 * Google Search Console 所有権確認タグ（2026-07-08 設置）
 */
function salud_gsc_verification() {
	echo '<meta name="google-site-verification" content="VNeU4suo3LgFpzYXp7VWEcPhbgoVOq0m2Qv8RnnzxWI">' . "\n";
}
add_action( 'wp_head', 'salud_gsc_verification', 1 );

/**
 * カスタム投稿タイプ（DESIGN: 01-sitemap.md に準拠）
 */
function salud_cpts() {
	$defs = array(
		'works'   => array( '導入事例', 'dashicons-portfolio' ),
		'seminar' => array( 'セミナー', 'dashicons-megaphone' ),
		'voice'   => array( 'お客様の声', 'dashicons-format-quote' ),
		'hojokin' => array( '補助金制度', 'dashicons-money-alt' ),
		'service' => array( 'サービス', 'dashicons-screenoptions' ),
		'news'    => array( 'お知らせ', 'dashicons-admin-post' ),
	);
	foreach ( $defs as $slug => $d ) {
		register_post_type( $slug, array(
			'label'        => $d[0],
			'public'       => true,
			'has_archive'  => true,
			'menu_icon'    => $d[1],
			'show_in_rest' => true,
			'supports'     => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
			'rewrite'      => array( 'slug' => $slug ),
		) );
	}
}
add_action( 'init', 'salud_cpts' );

/**
 * セミナー（CPT: seminar）の入力欄。
 * wp-admin > セミナー > 新規追加 だけで日時・講師・申込URL等を入力でき、
 * front-page.php 側は WP_Query でこのメタ情報を参照して自動表示する。
 */
function salud_seminar_meta_box() {
	add_meta_box(
		'salud_seminar_details',
		'セミナー詳細情報',
		'salud_seminar_meta_box_html',
		'seminar',
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'salud_seminar_meta_box' );

function salud_seminar_meta_box_html( $post ) {
	wp_nonce_field( 'salud_seminar_save', 'salud_seminar_nonce' );
	$fields = array(
		'salud_sem_date'       => array( '開催日', 'date' ),
		'salud_sem_time_start' => array( '開始時刻（例: 15:00）', 'text' ),
		'salud_sem_time_end'   => array( '終了時刻（例: 16:00）', 'text' ),
		'salud_sem_chip'       => array( 'タグ表示（例: オンライン・無料）', 'text' ),
		'salud_sem_venue'      => array( '開催形式（例: オンライン開催）', 'text' ),
		'salud_sem_lecturer'   => array( '講師', 'text' ),
		'salud_sem_apply_url'  => array( '申込／視聴URL（開催前は申込フォーム、開催後はアーカイブ視聴ページのURLに差し替え）', 'url' ),
		'salud_sem_note'       => array( '補足（例: ※第3部は個別相談会）', 'text' ),
	);
	echo '<table class="form-table">';
	foreach ( $fields as $key => $def ) {
		$value = get_post_meta( $post->ID, $key, true );
		printf(
			'<tr><th style="width:220px"><label for="%1$s">%2$s</label></th><td><input type="%3$s" id="%1$s" name="%1$s" value="%4$s" style="width:100%%;max-width:480px" /></td></tr>',
			esc_attr( $key ),
			esc_html( $def[0] ),
			esc_attr( $def[1] ),
			esc_attr( $value )
		);
	}
	echo '</table>';
	echo '<p class="description">この画面の入力内容が、トップページのセミナー告知欄・#/seminar 詳細ページ（開催日が今日以降なら「開催予定」、過去なら「アーカイブ」に自動振り分け）に反映されます。テーマファイルの編集は不要です。</p>';
}

function salud_seminar_save_meta( $post_id ) {
	if ( ! isset( $_POST['salud_seminar_nonce'] ) || ! wp_verify_nonce( $_POST['salud_seminar_nonce'], 'salud_seminar_save' ) ) {
		return;
	}
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	$keys = array( 'salud_sem_date', 'salud_sem_time_start', 'salud_sem_time_end', 'salud_sem_chip', 'salud_sem_venue', 'salud_sem_lecturer', 'salud_sem_apply_url', 'salud_sem_note' );
	foreach ( $keys as $key ) {
		if ( isset( $_POST[ $key ] ) ) {
			$value = ( 'salud_sem_apply_url' === $key ) ? sanitize_url( wp_unslash( $_POST[ $key ] ) ) : sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
			update_post_meta( $post_id, $key, $value );
		}
	}
}
add_action( 'save_post_seminar', 'salud_seminar_save_meta' );

/**
 * 開催予定（今日以降）のセミナーを開催日昇順で取得。
 */
function salud_get_upcoming_seminars( $limit = 6 ) {
	return new WP_Query( array(
		'post_type'      => 'seminar',
		'posts_per_page' => $limit,
		'meta_key'       => 'salud_sem_date',
		'orderby'        => 'meta_value',
		'order'          => 'ASC',
		'meta_query'     => array(
			array(
				'key'     => 'salud_sem_date',
				'value'   => current_time( 'Y-m-d' ),
				'compare' => '>=',
				'type'    => 'DATE',
			),
		),
	) );
}

/**
 * 開催済み（今日より前）のセミナーを開催日降順で取得。
 */
function salud_get_past_seminars( $limit = 6 ) {
	return new WP_Query( array(
		'post_type'      => 'seminar',
		'posts_per_page' => $limit,
		'meta_key'       => 'salud_sem_date',
		'orderby'        => 'meta_value',
		'order'          => 'DESC',
		'meta_query'     => array(
			array(
				'key'     => 'salud_sem_date',
				'value'   => current_time( 'Y-m-d' ),
				'compare' => '<',
				'type'    => 'DATE',
			),
		),
	) );
}

/**
 * seminar 投稿からカード表示用のHTMLを組み立てる。
 * $detailed = true の場合、#/seminar 詳細ページ用の meta 行付きカードを返す。
 */
function salud_render_seminar_card( $post_id, $detailed = false ) {
	$date_raw = get_post_meta( $post_id, 'salud_sem_date', true );
	$ts       = $date_raw ? strtotime( $date_raw ) : false;
	$month    = $ts ? strtoupper( date( 'M', $ts ) ) : '';
	$day      = $ts ? date( 'j', $ts ) : '';
	$week     = $ts ? date( 'D', $ts ) : '';
	$week_ja  = array( 'Mon' => '月', 'Tue' => '火', 'Wed' => '水', 'Thu' => '木', 'Fri' => '金', 'Sat' => '土', 'Sun' => '日' );
	$week     = isset( $week_ja[ $week ] ) ? $week_ja[ $week ] : $week;
	$start    = get_post_meta( $post_id, 'salud_sem_time_start', true );
	$chip     = get_post_meta( $post_id, 'salud_sem_chip', true ) ?: 'オンライン・無料';
	$apply    = get_post_meta( $post_id, 'salud_sem_apply_url', true ) ?: '#';
	$title    = get_the_title( $post_id );

	ob_start();
	?>
	<article class="sem rv">
	  <div class="date"><div class="m"><?php echo esc_html( $month ); ?></div><div class="d num"><?php echo esc_html( $day ); ?></div><div class="w"><?php echo esc_html( $week . ' ' . $start ); ?></div></div>
	  <div>
	    <span class="chip"><?php echo esc_html( $chip ); ?></span>
	    <h3><?php echo esc_html( $title ); ?></h3>
	    <?php if ( $detailed ) :
	      $end      = get_post_meta( $post_id, 'salud_sem_time_end', true );
	      $venue    = get_post_meta( $post_id, 'salud_sem_venue', true );
	      $lecturer = get_post_meta( $post_id, 'salud_sem_lecturer', true );
	      $note     = get_post_meta( $post_id, 'salud_sem_note', true );
	      $meta_bits = array_filter( array(
	        $ts ? wp_date( 'n/j', $ts ) . '（' . $week . '）' . $start . ( $end ? '〜' . $end : '' ) : '',
	        $venue,
	        $lecturer ? '講師：' . $lecturer : '',
	      ) );
	      ?>
	      <div class="meta"><?php echo esc_html( implode( ' ／ ', $meta_bits ) ); ?><?php echo $note ? '　' . esc_html( $note ) : ''; ?></div>
	      <a class="btn btn-yellow" style="padding:12px 28px;font-size:14.5px;margin-top:10px" href="<?php echo esc_url( $apply ); ?>" target="_blank" rel="noopener">申し込む →</a>
	    <?php else : ?>
	      <a class="apply" href="<?php echo esc_url( $apply ); ?>" target="_blank" rel="noopener">申し込む →</a>
	    <?php endif; ?>
	  </div>
	</article>
	<?php
	return ob_get_clean();
}

/**
 * 注記: このサイトは Yoast SEO プラグインが有効で、Organization / WebSite /
 * WebPage / BreadcrumbList の各Schemaと <title>・meta description・OGPは
 * 既に Yoast 側が出力している（wp-admin > SEO で編集可能）。
 * 同じ@idで内容の異なるSchemaを二重出力すると Rich Results Test でエラーの
 * 原因になるため、本テーマ側では Yoast が持たない Service / FAQPage のみを追加する。
 */

/**
 * ============ Service Schema（既存の補助金制度・サービス下層セクション用） ============
 * 新規ページは作成せず、既存の #/xxx ハッシュセクションに既にある見出し・説明文をそのまま利用する。
 */
function salud_existing_services() {
	return array(
		array( 'hash' => 'support', 'name' => '補助金申請支援（総合）', 'desc' => '中小企業庁認定の経営革新等支援機関として、専門家チームが診断から採択後まで伴走します。' ),
		array( 'hash' => 'jizokuka', 'name' => '小規模事業者持続化補助金', 'desc' => '小規模事業者の販路開拓や業務効率化の取り組みを対象に、最大250万円（補助率2/3）が交付される制度の申請支援。' ),
		array( 'hash' => 'it', 'name' => 'デジタル化・AI導入補助金', 'desc' => '業務効率化や売上向上に役立つソフトウェア・クラウドサービス・AIツールの導入費用を補助する制度の申請支援。' ),
		array( 'hash' => 'shorikika', 'name' => '省力化投資補助金', 'desc' => '人手不足に悩む中小企業の省力化・自動化のための設備・システム導入費用を補助する制度の申請支援。' ),
		array( 'hash' => 'shinjigyo', 'name' => '新事業進出・ものづくり補助金', 'desc' => '革新的な製品・サービス開発から新市場への進出、海外展開までを支援する制度の申請支援。' ),
		array( 'hash' => 'seicho', 'name' => '成長加速化補助金', 'desc' => '売上拡大を目指す成長意欲の高い中小企業の大規模投資を支援する制度の申請支援。' ),
		array( 'hash' => 'shokei', 'name' => '事業承継・M&A補助金', 'desc' => '事業承継やM&Aをきっかけとした新たな取り組みを支援する制度の申請支援。' ),
		array( 'hash' => 'nenkan', 'name' => '年間補助金戦略サポート', 'desc' => '年間の事業計画にもとづき「使える補助金」を計画的に活用するための中長期の伴走支援。' ),
		array( 'hash' => 'yuushi', 'name' => '融資支援', 'desc' => '創業融資から設備・運転資金まで、事業計画書の作成から金融機関との交渉、補助金との併用設計までを支援。' ),
		array( 'hash' => 'web', 'name' => 'ホームページ制作', 'desc' => '補助金を活用したホームページ制作。申請から制作・集客までワンストップで対応。' ),
	);
}
function salud_service_schema() {
	if ( SALUD_NOINDEX || ! is_front_page() ) {
		return;
	}
	foreach ( salud_existing_services() as $s ) {
		$schema = array(
			'@context'    => 'https://schema.org',
			'@type'       => 'Service',
			'@id'         => home_url( '/#/' . $s['hash'] . '-service' ),
			'serviceType' => $s['name'],
			'name'        => $s['name'],
			'description' => $s['desc'],
			'url'         => home_url( '/#/' . $s['hash'] ),
			'provider'    => array( '@id' => home_url( '/#organization' ) ),
			'areaServed'  => array( '@type' => 'Country', 'name' => '日本' ),
			'audience'    => array( '@type' => 'Audience', 'audienceType' => '中小企業・個人事業主' ),
		);
		echo '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
	}
}
add_action( 'wp_head', 'salud_service_schema', 23 );

/**
 * ============ FAQPage Schema（TOPページの「よくあるご質問」セクション用） ============
 * ChatGPT・Google AI Overviews 等に引用されやすくするため機械可読で出力する。
 * Organization/WebSite/WebPage/Breadcrumb は Yoast SEO が既に出力しているため重複させない。
 */
function salud_jsonld() {
	// 検索非公開の間は構造化データも出さない（確認後に本公開でまとめて有効化）
	if ( SALUD_NOINDEX ) {
		return;
	}
	// フロントページの「よくあるご質問」セクション（#page-faq）に実在する14問と完全一致させる。
	// ※ Rich Results はページ表示内容とSchemaの不一致を許容しないため、新規作成はせず既存文言をそのまま使用。
	if ( is_front_page() ) {
		$faq = array(
			'@context'   => 'https://schema.org',
			'@type'      => 'FAQPage',
			'mainEntity' => array(
				salud_faq( '相談や診断に費用はかかりますか？', '補助金診断・初回相談は無料です。ご依頼いただく場合は基本料金（内容により個別にお見積り）と、採択時のみ成功報酬（採択金額の10〜15%）をいただきます。不採択の場合、成功報酬は発生せず、同じ補助金への再申請は2回目まで無料です。' ),
				salud_faq( '自社に合う補助金がわかりません。何から始めればいいですか？', 'まずは30秒の無料診断をお試しください。会社の基本情報を入力するだけで、AIが最適な制度を提案します。その結果をもとに専門家が詳しくご案内します。' ),
				salud_faq( '地方の会社ですが対応してもらえますか？', 'はい、全国対応しています。オンライン（Zoom・LINE）での打ち合わせに特化しているため、地域を問わず同じ品質でご相談いただけます。' ),
				salud_faq( '書類作成は全部お任せできますか？', '申請書類は行政書士が作成しますが、いわゆる「丸投げ」の代行サービスではありません。補助事業の内容についてヒアリングシートへのご記入と、精度を高めるためのお打ち合わせにご協力いただきます。申請手続き自体はオンラインで、マニュアルとZoomサポートをご用意しています。' ),
				salud_faq( 'ホームページ制作に補助金は使えますか？', '制度によっては対象になります。小規模事業者持続化補助金やIT導入補助金など、Web制作と組み合わせられる制度のご提案から申請まで一括でサポートできるのがSaludの強みです。' ),
				salud_faq( 'ITに詳しい社員がいなくてもAI導入はできますか？', '問題ありません。ツールの選定から初期設定、社内向けの使い方レクチャーまで含めて支援します。導入後もLINEで気軽にご質問いただけます。' ),
				salud_faq( '採択された後は何をすればいいですか？', '採択後は交付申請・補助事業の実施・実績報告を経て、補助金が入金されます。取引書類の整理や報告書の作成もサポートしますのでご安心ください（採択後サポートは別途、伴走プラン月額1.5万円〜）。' ),
				salud_faq( '個人事業主でも申請できますか？', 'はい、個人事業主も対象です。多くの補助金制度は「中小企業・小規模事業者」を対象としており、個人事業主も要件を満たせばご利用いただけます。' ),
				salud_faq( '創業したばかりでも相談できますか？', 'はい、ご相談いただけます。創業融資は日本政策金融公庫や制度融資に対応しており、創業準備の段階からサポート可能です。補助金は制度によって創業〇ヶ月以上などの要件がある場合があるため、無料相談で該当する制度をご案内します。' ),
				salud_faq( '補助金と融資はどちらを利用すればいいですか？', '補助金は原則返済不要、融資は返済が必要な借入という違いがあります。どちらか一方ではなく、補助金と融資を組み合わせた資金設計もご提案可能です。まずは無料相談で、貴社の資金計画に合わせた最適な組み合わせをご案内します。' ),
				salud_faq( '他の申請代行会社とは何が違いますか？', 'Saludは中小企業庁認定の経営革新等支援機関で、中小企業診断士・行政書士など専門家8名が在籍しています。審査員目線で事業計画を磨き上げ、小規模事業者持続化補助金では事前確認130件超・採択率82%の実績があります。成功報酬型のため、不採択の場合は成功報酬が発生しません。' ),
				salud_faq( '顧問契約や継続契約は必要ですか？', 'いいえ、必須ではありません。単発のご依頼も承っています。採択後の実行支援や中長期的な補助金活用をご希望の場合は、伴走プランや年間補助金戦略サポートを任意でお選びいただけます。' ),
				salud_faq( '相談から採択まではどのくらいの期間がかかりますか？', '無料診断・相談から書類作成、申請、採択発表までの期間は、制度の公募スケジュールによって異なります。目安として、ご相談から申請書類の作成・提出まで数週間〜1ヶ月程度、その後の採択発表までは制度ごとの審査期間が必要です。具体的なスケジュールは無料相談でご案内します。' ),
				salud_faq( '年に複数の補助金を申請することはできますか？', 'はい、可能です。単発の申請だけでなく、年間の事業計画にもとづいて複数の制度を計画的に活用したい方向けに「年間補助金戦略サポート」もご用意しています。制度の選定からスケジュール設計、融資との資金設計まで継続的にサポートします。' ),
				salud_faq( '補助金の対象になる経費にはどのようなものがありますか？', '制度によって異なりますが、設備費・システム導入費・広報費・専門家への謝金など幅広い経費が対象になり得ます。ホームページ制作費も、集客につながるサイトであれば対象になる場合があります。どの経費が使えるかは事業内容によって変わるため、無料相談で具体的にご案内します。' ),
				salud_faq( '採択されればすぐに補助金は振り込まれますか？', 'いいえ、採択後すぐに入金されるわけではありません。補助金は原則「後払い」で、交付決定後に補助事業を実施し、実績報告を提出・確定検査を経てから入金されます。事業実施にかかる費用は一旦自己資金や融資で立て替える必要があるため、資金計画も含めてご相談いただけます。' ),
				salud_faq( 'どのくらいの規模の会社が対象になりますか？', '多くの補助金は「中小企業」「小規模事業者」が対象で、業種ごとに従業員数・資本金の基準が中小企業基本法で定められています。個人事業主も対象に含まれる制度がほとんどです。自社が対象になるかは無料診断・相談で確認できます。' ),
				salud_faq( '打ち合わせは対面でもできますか？', '基本的にはZoom・LINEを使ったオンラインでの対応となります。全国どこからでも同じ品質でご相談いただけるよう、あえてオンラインに特化しています。対面が必要な場合は個別にご相談ください。' ),
				salud_faq( '自分で申請するのと依頼するのとでは何が違いますか？', '補助金は自分で申請することも可能ですが、事業計画書の書き方や要件の解釈次第で採択率が大きく変わります。Saludは審査員目線で事業計画をブラッシュアップしており、小規模事業者持続化補助金では事前確認130件超・採択率82%の実績があります。書類作成の手間や専門知識の不足を補える点が、依頼するメリットです。' ),
				salud_faq( '中小企業省力化投資補助金と新事業進出・ものづくり補助金はどう違いますか？', '中小企業省力化投資補助金は、人手不足解消のための省力化・自動化設備（IoT・ロボット等）の導入を支援する制度です。一方、新事業進出・ものづくり商業サービス補助金は、新分野展開や革新的な製品・サービス開発など挑戦的な事業を支援する制度です。どちらが自社に適するかは、無料診断でご案内します。' ),
				salud_faq( '相談したら必ず依頼しないといけませんか？', 'いいえ、そのようなことはありません。無料相談・診断はあくまで情報提供の場です。ご提案内容にご納得いただけた場合のみご依頼ください。強引な勧誘は行いませんので、まずはお気軽にご相談ください。' ),
			),
		);
		echo '<script type="application/ld+json">' . wp_json_encode( $faq, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
	}
}
add_action( 'wp_head', 'salud_jsonld', 20 );

function salud_faq( $q, $a ) {
	return array(
		'@type'          => 'Question',
		'name'           => $q,
		'acceptedAnswer' => array( '@type' => 'Answer', 'text' => $a ),
	);
}

/**
 * <title> / OGP / TOPの meta description は Yoast SEO プラグインが必ず出力するため
 * テーマ側では出力しない（TOPの説明文を変えたい場合は wp-admin > SEO > 検索での見え方 >
 * フロントページ設定を編集）。
 * ただし固定ページ（/contact/ 等）は Yoast側で個別description未設定だと空になるため、
 * そのページに限りフォールバックを出力する（フロントページは対象外＝重複させない）。
 */
function salud_meta_description_fallback() {
	if ( SALUD_NOINDEX || is_front_page() || ! is_singular() ) {
		return;
	}
	if ( ! empty( get_post_meta( get_the_ID(), '_yoast_wpseo_metadesc', true ) ) ) {
		return;
	}
	$desc = has_excerpt() ? get_the_excerpt() : wp_trim_words( wp_strip_all_tags( get_the_content() ), 40 );
	if ( ! $desc ) {
		return;
	}
	$desc = mb_substr( wp_strip_all_tags( $desc ), 0, 120 );
	echo '<meta name="description" content="' . esc_attr( $desc ) . '">' . "\n";
}
add_action( 'wp_head', 'salud_meta_description_fallback', 30 );

/**
 * ============ Google Analytics 4 ============
 * 管理画面ログイン中（自分自身のアクセス）は計測しないよう除外。
 */
function salud_ga4() {
	if ( is_user_logged_in() ) {
		return;
	}
	?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?php echo esc_attr( SALUD_GA4_ID ); ?>"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '<?php echo esc_js( SALUD_GA4_ID ); ?>');
</script>
	<?php
}
add_action( 'wp_head', 'salud_ga4', 2 );

/**
 * ============ GA4 コンバージョンイベント ============
 * 診断ツールクリック／LINE追加クリック／電話クリック／お問い合わせフォーム送信を計測。
 */
function salud_ga4_events() {
	if ( is_user_logged_in() ) {
		return;
	}
	?>
<script>
document.addEventListener('click', function (e) {
  if (typeof gtag !== 'function') { return; }
  var diag = e.target.closest('a[href*="hojokin-app.vercel.app"]');
  if (diag) { gtag('event', 'diagnosis_click', { event_category: 'engagement', event_label: diag.href }); return; }
  var line = e.target.closest('a[href*="line.me"]');
  if (line) { gtag('event', 'line_add_click', { event_category: 'engagement', event_label: line.href }); return; }
  var tel = e.target.closest('a[href^="tel:"]');
  if (tel) { gtag('event', 'tel_click', { event_category: 'engagement', event_label: tel.href }); return; }
}, true);
document.addEventListener('wpcf7mailsent', function () {
  if (typeof gtag !== 'function') { return; }
  gtag('event', 'contact_form_submit', { event_category: 'conversion', event_label: 'contact_form' });
});
</script>
	<?php
}
add_action( 'wp_footer', 'salud_ga4_events' );
