<?php
/**
 * 404（ページが見つからない）
 * @package Salud
 */
get_header();
?>
<div class="page">
<section class="article-head" style="text-align:center">
  <div class="wrap article-wrap">
    <div class="sec-en" style="justify-content:center"><b>4</b>04</div>
    <h1 class="article-title">ページが見つかりませんでした</h1>
    <p class="lede" style="margin:0 auto 28px">お探しのページは移動または削除された可能性があります。</p>
    <a class="btn btn-primary btn-xl" href="<?php echo esc_url( home_url( '/' ) ); ?>">トップへ戻る</a>
  </div>
</section>
</div>
<?php
get_footer();
