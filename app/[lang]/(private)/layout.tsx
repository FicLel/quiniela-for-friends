import { notFound } from 'next/navigation'
import { getDictionary, hasLocale } from '@/i18n/getDictionary'
import { Navbar } from '@/app/_components/Navbar'

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

export default async function PrivateLayout({ children, params }: LayoutProps) {
  const { lang } = await params
  if (!hasLocale(lang)) notFound()
  const dict = await getDictionary(lang)

  return (
    <>
      <Navbar lang={lang} dict={dict.navbar} />
      {children}
    </>
  )
}
