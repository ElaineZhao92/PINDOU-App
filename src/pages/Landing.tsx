import { Link } from 'react-router-dom'

export default function Landing() {
  const features = [
    {
      icon: '🎨',
      title: '221种颜色管理',
      desc: '覆盖A-H全系列221种拼豆颜色，精准追踪每种颜色的库存数量。',
    },
    {
      icon: '🤖',
      title: 'AI图纸分析',
      desc: '上传图纸图片，AI自动识别所需颜色和数量，智能计算缺货清单。',
    },
    {
      icon: '📦',
      title: '低库存预警',
      desc: '自定义预警阈值，及时发现库存不足的颜色，从不断货。',
    },
    {
      icon: '📋',
      title: '图纸档案管理',
      desc: '保存历史图纸记录，追踪制作进度，完美管理你的创作历程。',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base">豆</span>
          </div>
          <span className="font-bold text-gray-800 text-xl">我嘞个豆</span>
        </div>
        <Link
          to="/login"
          className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
        >
          登录 / 注册
        </Link>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <span>拼豆库存管理</span>
          <span>·</span>
          <span>PINDOU 拼豆</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 leading-tight">
          管理你的
          <span className="text-primary"> 拼豆库存</span>
          <br />
          让创作更轻松
        </h1>
        <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          专为拼豆爱好者设计的库存管理工具。AI分析图纸、智能预警补货、
          轻松管理221种颜色豆子的库存。
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="px-8 py-3.5 bg-primary text-white font-semibold rounded-xl shadow-lg hover:bg-primary-600 transition-all hover:shadow-xl hover:-translate-y-0.5 text-base"
          >
            开始使用 →
          </Link>
          <a
            href="#features"
            className="px-8 py-3.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-base"
          >
            了解更多
          </a>
        </div>
      </section>

      {/* Color palette preview */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-white rounded-3xl shadow-xl p-6 overflow-hidden">
          <p className="text-center text-sm text-gray-400 mb-4 font-medium">221种颜色，一目了然</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {PREVIEW_COLORS.map((hex, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-md shadow-sm"
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
          为什么选择我嘞个豆？
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16 px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
          准备好开始管理你的豆子了吗？
        </h2>
        <p className="text-primary-100 mb-8 text-base">免费使用，立即开始</p>
        <Link
          to="/login"
          className="inline-block px-8 py-3.5 bg-white text-primary font-semibold rounded-xl hover:bg-gray-50 transition-colors shadow-lg"
        >
          免费注册账号
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-400 text-sm">
        <p>© 2024 我嘞个豆 · PINDOU 拼豆库存管理</p>
      </footer>
    </div>
  )
}

const PREVIEW_COLORS = [
  '#FFF8E7','#FFFD5A','#FFE600','#FFD800','#FFC400','#FFAA00','#FF8C00','#FF6600',
  '#FF4500','#FF2200','#EE0011','#CC0011','#FF0066','#FF1199','#FF00CC','#FF44DD',
  '#EE44EE','#FF88BB','#FFAACC','#FFBBCC','#CCFF00','#AAFF00','#88EE00','#66DD00',
  '#44CC00','#22BB00','#00AA00','#009900','#007700','#005500','#00AA44','#00BB66',
  '#00CC88','#00DDAA','#00EEBB','#00FFCC','#99FF88','#BBFF99','#00FFFF','#00EEFF',
  '#00DDEE','#00BBDD','#0099CC','#0077BB','#0055AA','#003399','#001188','#0033CC',
  '#0055EE','#0077FF','#2299FF','#44AAFF','#66BBFF','#88CCFF','#EE00FF','#CC00EE',
  '#AA00DD','#8800CC','#6600BB','#9900CC','#BB00EE','#DD22FF','#EE55FF','#FF88FF',
  '#FFF0CC','#FFDD99','#FFCC77','#FFB855','#FFA033','#EE8811','#DD7700','#CC6600',
  '#FFFFFF','#EEEEEE','#DDDDDD','#CCCCCC','#BBBBBB','#AAAAAA','#999999','#888888',
  '#777777','#666666','#555555','#444444','#333333','#222222','#111111','#000000',
  '#FFD700','#FFC0CB','#C0C0C0','#FF69B4','#FF1493','#FF00FF','#BA55D3','#9400D3',
]
