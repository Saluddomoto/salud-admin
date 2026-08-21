<?php
/**
 * 固定ページ（会社概要・プライバシーポリシー等）
 * WordPress の通常エディタで自由に編集できます。
 * @package Salud
 */
get_header();
?>
<div class="page">
<section class="article-head">
  <div class="wrap article-wrap">
    <?php while ( have_posts() ) : the_post(); ?>
      <h1 class="article-title"><?php the_title(); ?></h1>
      <div class="article-body"><?php the_content(); ?></div>
    <?php endwhile; ?>
  </div>
</section>
</div>
<?php
get_footer();
