import React from 'react'
import { Loader2 } from 'lucide-react'

const loading = () => {
  return (
    <div className='flex justify-center items-center h-screen'>
      <Loader2 className='animate-spin' />
    </div>
  )
}

export default loading
