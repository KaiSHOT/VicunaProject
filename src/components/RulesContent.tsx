// メニューの「ルール画面」と対AI戦中の「？ヘルプ」モーダルで共用するルール本文。

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-bold text-vicuna-accent-light">{title}</h3>
      <div className="text-sm text-vicuna-text-secondary leading-relaxed flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
}

export default function RulesContent() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="ゲームの目的">
        <p>
          手札をいち早く出し切るか、出し切れなくても失点（チップ）をできるだけ増やさないように立ち回るゲーム。
        </p>
        <p>誰かの累計失点が40点に達したらゲーム終了。その時点で失点が一番少ない人の勝ち。</p>
      </Section>

      <Section title="使うカード">
        <p>1〜6の数字カードが各8枚、特殊カード「ビクーニャ」が8枚の、合計56枚。</p>
        <p>ビクーニャは数字でいうと「6の次・1の前」の位置にあり、失点は10点相当として扱う。</p>
      </Section>

      <Section title="出せるカードのルール">
        <p>場に出ているカードと「同じ数字」か「次の数字」のカードだけが出せる。</p>
        <p>数字は 1→2→3→4→5→6→ビクーニャ→1→… という順番でつながっている（ループする）。</p>
      </Section>

      <Section title="自分の手番でできること">
        <p>
          <span className="font-bold text-vicuna-text-primary">出す</span>:
          場に出せるカードがあれば手札から出す。手札が0枚になったら「上がり」で、そのラウンドは即終了。
        </p>
        <p>
          <span className="font-bold text-vicuna-text-primary">山札から引く</span>:
          出せるカードがない時などに山札から1枚引いて手番を終える（山札切れ、または自分が最後の1人の場合は引けない）。
        </p>
        <p>
          <span className="font-bold text-vicuna-text-primary">降りる</span>:
          そのラウンドから抜ける。ただし予約中は降りられない。
        </p>
        <p>
          <span className="font-bold text-vicuna-text-primary">予約する</span>:
          自分の最初の手番に限り宣言できる、一発逆転を狙うアクション（詳細は次項）。
        </p>
        <p>
          <span className="font-bold text-vicuna-text-primary">投了</span>:
          予約中に「出せるカードがなく、山札からも引けない」という手詰まりになった時だけの救済アクション（実質は予約失敗と同義）。
          本家LAMAにはないハウスルールで、行き詰まり防止のために追加された。
        </p>
      </Section>

      <div className="bg-vicuna-risk/20 border border-vicuna-risk rounded-lg p-4 flex flex-col gap-2">
        <h3 className="text-base font-bold text-vicuna-risk-light">予約（一発逆転）</h3>
        <div className="text-sm text-vicuna-text-secondary leading-relaxed flex flex-col gap-1">
          <p>・宣言できるのは各プレイヤーの最初の手番のみ。1ラウンドにつき1人まで（早い者勝ち）。</p>
          <p>・予約すると、そのラウンド中は降りられなくなる（ハイリスク・ハイリターン）。</p>
          <p>
            ・
            <span className="font-bold text-vicuna-text-primary">成功</span>
            （手札を出し切って上がれた）: チップを2枚、銀行に返却できる（通常の上がりは1枚）。
          </p>
          <p>
            ・
            <span className="font-bold text-vicuna-text-primary">失敗</span>
            （上がれなかった）: 通常の手札失点に加えて、+5点の追加ペナルティ。
          </p>
        </div>
      </div>

      <Section title="ラウンドの終わり方と失点計算">
        <p>誰かが手札を出し切って上がるか、残りの全員が降りる・行き詰まるとラウンド終了。</p>
        <p>
          上がった人の失点は0。それ以外の人は、手札に残ったカードの
          <span className="font-bold text-vicuna-text-primary">「異なる数字ごとの合計」</span>
          が失点になる（同じ数字を何枚持っていても1回分としてしかカウントされない）。
        </p>
        <p>上がった人は、既に持っているチップの中で一番高いもの1枚を銀行に返せる（予約成功なら2枚）。</p>
      </Section>

      <div className="bg-vicuna-panel/60 rounded-lg p-4 flex flex-col gap-2">
        <h3 className="text-base font-bold text-vicuna-info-light">チップ銀行</h3>
        <div className="text-sm text-vicuna-text-secondary leading-relaxed flex flex-col gap-1">
          <p>黒チップ（10点相当）は銀行に20枚までしかない共有の物理制限。白チップ（1点相当）は無制限。</p>
          <p>銀行の黒が尽きたら、代わりに白チップ10枚分で同じ点数を受け取る。</p>
          <p>
            ラウンド終了後、白チップを10枚以上持っている人がいれば、
            <span className="font-bold text-vicuna-text-primary">累計失点が多い順</span>
            に、銀行の黒が尽きるまで「白10枚→黒1枚」に自動で両替される。
          </p>
        </div>
      </div>

      <Section title="ゲームの終了">
        <p>誰かの累計失点が40点以上になった時点でゲーム終了。その時点で失点が一番少ない人が勝ち。</p>
      </Section>
    </div>
  );
}
