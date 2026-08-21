<?php
/**
 * 記事ページ（ブログ・お知らせ・実績など単一投稿）
 * 本文は WordPress の通常エディタで編集 → そのまま反映されます。
 * @package Salud
 */
get_header();
?>
<div class="page">
<section class="article-head">
  <div class="wrap article-wrap">
    <?php while ( have_posts() ) : the_post(); ?>
      <p class="crumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">TOP</a> ›
        <a href="<?php echo esc_url( get_post_type_archive_link( get_post_type() ) ?: home_url( '/' ) ); ?>"><?php echo esc_html( get_post_type_object( get_post_type() )->labels->name ); ?></a>
      </p>
      <p class="article-meta">
        <span class="num"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span>
        <?php if ( get_the_category() ) : ?>　<span class="cat"><?php the_category( ' / ' ); ?></span><?php endif; ?>
      </p>
      <h1 class="article-title"><?php the_title(); ?></h1>
      <?php if ( has_post_thumbnail() ) : ?>
        <?php the_post_thumbnail( 'large', array( 'class' => 'article-thumb' ) ); ?>
      <?php endif; ?>

      <div class="article-body">
        <?php the_content(); ?>
      </div>

      <?php
      // 監修者（カスタムフィールド author_name / author_role / author_bio があれば表示）
      $an = get_post_meta( get_the_ID(), 'author_name', true );
      if ( $an ) : ?>
        <div class="article-author">
          <?php if ( $img = get_post_meta( get_the_ID(), 'author_image', true ) ) : ?><img src="<?php echo esc_url( $img ); ?>" alt="<?php echo esc_attr( $an ); ?>"><?php endif; ?>
          <div>
            <div class="r"><?php echo esc_html( get_post_meta( get_the_ID(), 'author_role', true ) ); ?></div>
            <div class="n"><?php echo esc_html( $an ); ?> <span style="font-size:12px;color:var(--ink-3)">監修</span></div>
            <p class="b"><?php echo esc_html( get_post_meta( get_the_ID(), 'author_bio', true ) ); ?></p>
          </div>
        </div>
      <?php endif; ?>

      <div class="article-cta">
        <h3>あなたの会社に使える補助金は？</h3>
        <p>SWOT分析で最適な補助金を上位3つ選定。30秒・登録不要・無料です。</p>
        <a class="btn btn-yellow btn-xl" href="<?php echo esc_url( salud_opt( 'diag_url', '#' ) ); ?>" target="_blank" rel="noopener">30秒で無料診断する →</a>
      </div>
    <?php endwhile; ?>
  </div>
</section>
</div>
<?php
get_footer();
