import Image from 'next/image'
import logo from '@/public/logo.svg'

interface LogoProps {
  size?: number
  className?: string
  animated?: boolean
}

export default function Logo({ size = 48, className = '', animated = false }: LogoProps) {
  return (
    <Image
      src={logo}
      alt="GroupTab"
      width={size}
      height={size}
      className={`${animated ? 'anim-logo' : ''} ${className}`}
      priority
    />
  )
}
