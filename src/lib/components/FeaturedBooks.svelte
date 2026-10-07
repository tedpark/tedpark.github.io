<script lang="ts">
 const books = [
  { title: 'Building Tauri 2 Desktop Apps with AI, from Start to Finish', original: 'AI와 끝까지 완성하는 Tauri 2 데스크톱 앱', detail: 'AI-assisted desktop development: requirements, implementation, verification, and release.', href: 'https://wikidocs.net/book/21320', access: 'Free selected chapters' },
  { title: 'AI Built the Trading System. Who Checks It?', original: 'AI가 만든 자동매매, 검증은 누가 할까?', detail: 'Reviewing data, backtest accounting, and the assumptions in an AI-assisted Python trading system.', href: 'https://wikidocs.net/book/21322', access: 'Free selected chapters' },
  { title: 'Hiring Developers: A Developer’s Perspective', original: '개발자를 뽑는 개발자', detail: 'Practical lessons from reviewing applications and conducting technical interviews.', href: 'https://wikidocs.net/book/21402', access: 'Free full text' }
 ];
</script>
<section class="max-w-5xl mx-auto px-6 py-16 border-t border-border">
 <p class="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Writing from practice · Korean books</p>
 <h2 class="text-3xl font-semibold mb-7">Build, verify, explain.</h2>
 <p class="text-sm text-muted-foreground mb-6">English title translations are shown below. These links open the Korean editions.</p>
 <div class="grid md:grid-cols-3 gap-4">
  {#each books as book}
   <a href={book.href} class="block rounded-xl border border-border bg-card p-6 hover:border-foreground/40 transition-colors">
    <h3 class="text-xl font-semibold leading-snug mb-4">{book.title}</h3>
    <p class="text-xs text-muted-foreground mb-4">Original title: <span lang="ko">{book.original}</span></p>
    <p class="text-sm text-foreground/70 leading-relaxed mb-5">{book.detail}</p>
    <span class="text-xs text-muted-foreground">WikiDocs · {book.access} ↗</span>
   </a>
  {/each}
 </div>
 <p class="mt-6 text-sm text-foreground/70">Also available to read on <a href="https://books.quantsigma.ai/" class="underline underline-offset-4">Folio Books ↗</a>.</p>
</section>
