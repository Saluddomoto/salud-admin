<?php
/**
 * アーカイブ（カテゴリ・カスタム投稿タイプ・日付など）
 * @package Salud
 */
get_header();
?>
<div class="page">
<section class="article-head">
  <div class="wrap">
    <div class="sec-head rv">
      <div class="sec-en"><b>A</b>rchive</div>
      <div class="sec-ja"><?php echo esc_html( wp_strip_all_tags( get_the_archive_title() ) ); ?></div>
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
      <p class="lede">この条件の記事はまだありません。</p>
    <?php endif; ?>
  </div>
</section>
</div>
<?php
get_footer();
