<?php
/**
 * フォールバック（他のテンプレートに該当しない場合）。ブログ一覧を表示。
 * @package Salud
 */
get_header();
?>
<div class="page">
<section class="article-head">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="sec-en"><b>B</b>log</div>
      <div class="sec-ja">補助金・集客の最新情報</div>
    </div>
    <?php if ( have_posts() ) : ?>
      <div class="blog-list">
        <?php while ( have_posts() ) : the_post(); ?>
          <a class="blog-card" href="<?php the_permalink(); ?>">
            <?php if ( has_post_thumbnail() ) : the_post_thumbnail( 'medium_large', array( 'class' => 'thumb' ) ); else : ?><span class="thumb"></span><?php endif; ?>
            <div class="body">
              <span class="bd num"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span>
              <span class="ttl"><?php the_title(); ?></span>
              <p class="ex"><?php echo esc_html( wp_trim_words( get_the_excerpt(), 50 ) ); ?></p>
            </div>
          </a>
        <?php endwhile; ?>
      </div>
      <div class="blog-pager"><?php echo paginate_links( array( 'prev_text' => '‹ 前へ', 'next_text' => '次へ ›' ) ); ?></div>
    <?php else : ?>
      <p class="lede">まだ記事がありません。WordPress管理画面の「投稿 → 新規追加」から書けます。</p>
    <?php endif; ?>
  </div>
</section>
</div>
<?php
get_footer();
